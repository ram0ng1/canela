<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Preload;

use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Theme\FontFamily;

/**
 * A casca do tema já na primeira pintura.
 *
 * O HTML do Flarum chega com `#app` cru, e as classes da casca (`.Canela`,
 * barra aberta, botões em pílula…) só entram quando o JS monta — até lá o
 * navegador já pintou o cabeçalho sem estilo e o conteúdo sem o espaço da
 * barra, e tudo salta no boot (CLS ~0,13 em toda primeira carga).
 *
 * Um script mínimo no `<head>` observa o parse e, assim que o cabeçalho
 * existe, aplica as mesmas classes que o `installShell()` aplicaria e cria
 * os encaixes vazios do cabeçalho (hambúrguer e centro), que o JS reaproveita.
 * A barra aberta ou fechada segue a mesma regra do `sidebarState.ts`: a
 * escolha guardada no localStorage, senão o padrão do admin; só no tablet
 * para cima.
 *
 * A fonte do tema (latin) também vai num `<link rel="preload">`: sem isso ela
 * chegava depois do boot e a troca de fonte quebrava a barra de abas em duas
 * linhas, empurrando a lista (CLS ~0,09 no índice logado).
 */
final class PreBootShell
{
    /** O arquivo latin de cada família (o latin-ext só baixa se a página precisar). */
    private const FONT_FILES = [
        FontFamily::INTER => 'inter-latin-wght-normal.woff2',
        FontFamily::JAKARTA => 'plus-jakarta-sans-latin-wght-normal.woff2',
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $attrs = $document->getForumApiDocument()['data']['attributes'] ?? [];

        if (! is_array($attrs)) {
            return;
        }

        // A mesma leitura do `forumBool()` do JS: ausente ou null vale o padrão.
        $bool = static fn (string $name, bool $default): bool => isset($attrs[$name]) ? (bool) $attrs[$name] : $default;

        $sidebar = $bool('canelaSidebarEnabled', true);
        $classes = array_keys(array_filter([
            'Canela' => true,
            'Canela--pillButtons' => $bool('canelaPillButtons', true),
            'Canela--tinted' => $bool('canelaTintedBackground', true),
            'Canela--card' => $bool('canelaContentCard', true),
            'Canela--noSidebar' => ! $sidebar,
            'Canela--headerSearch' => $bool('canelaHeaderSearch', true),
            'Canela--noEventPosts' => ! $bool('canelaTopicEventPosts', false),
        ]));

        $config = json_encode([
            'classes' => $classes,
            'sidebar' => $sidebar,
            'open' => $bool('canelaSidebarOpenDefault', true),
            'logoOnly' => ! $bool('canelaShowTitleWithLogo', false),
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

        $font = self::FONT_FILES[(new FontFamily())($this->settings->get(FontFamily::SETTING))] ?? null;
        $assets = $attrs['assetsBaseUrl'] ?? null;

        if ($font !== null && is_string($assets) && $assets !== '') {
            $document->preloads[] = [
                'href' => rtrim($assets, '/').'/extensions/ramon-canela/fonts/'.$font,
                'as' => 'font',
                'type' => 'font/woff2',
                'crossorigin' => '',
            ];
        }

        $document->head[] = '<script>'.str_replace('__CONFIG__', (string) $config, self::SCRIPT).'</script>';

        // O script do core no <head> resolve o modo só pela preferência que o
        // servidor conhece; o visitante que escolheu claro/escuro guarda a
        // escolha no sessionStorage, que o core só lê no boot do JS. Sem isto,
        // a página pintava no modo do sistema e trocava depois (escuro → claro).
        // Como no core, a escolha do visitante só vale com o padrão do fórum em "auto".
        if (($this->settings->get('color_scheme') ?? 'auto') === 'auto') {
            $document->head[] = '<script>'.self::THEME_SCRIPT.'</script>';
        }
    }

    /** O mesmo que o initColorScheme() do core faz no boot, antes da primeira pintura. */
    private const THEME_SCRIPT = <<<'JS'
(function () {
  try {
    var d = document.documentElement;
    if (!d.classList.contains('guest-user')) return;
    var s = sessionStorage.getItem('colorScheme');
    if (!s) return;
    if (s === 'auto') {
      s = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (matchMedia('(prefers-contrast: more)').matches || localStorage.getItem('canela.highContrast') === '1') s += '-hc';
    }
    d.setAttribute('data-theme', s);
  } catch (e) {}
})();
JS;

    /** Sem dependências e à prova de erro: no pior caso, a página fica como antes. */
    private const SCRIPT = <<<'JS'
(function (c) {
  try {
    var open = false;
    if (c.sidebar && window.matchMedia('(min-width: 768px)').matches) {
      var stored = null;
      try { stored = localStorage.getItem('canela.sidebarOpen'); } catch (e) {}
      open = stored === null ? c.open : stored === '1';
    }
    var apply = function () {
      var app = document.getElementById('app');
      var header = document.querySelector('#header > .container');
      var secondary = document.getElementById('header-secondary');
      if (!app || !header || !secondary) return false;
      app.classList.add.apply(app.classList, c.classes.concat(open ? ['Canela--sidebarOpen'] : []));
      if (c.logoOnly) header.classList.add('CanelaHeader--logoOnly');
      var title = header.querySelector('.Header-title');
      if (c.sidebar && title && !header.querySelector('.CanelaHeader-toggleSlot')) {
        var toggle = document.createElement('div');
        toggle.className = 'CanelaHeader-toggleSlot';
        header.insertBefore(toggle, title);
      }
      if (!header.querySelector('.CanelaHeader-center')) {
        var center = document.createElement('div');
        center.className = 'CanelaHeader-search CanelaHeader-center';
        header.insertBefore(center, secondary);
      }
      return true;
    };
    var observer = new MutationObserver(function () { if (apply()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { observer.disconnect(); });
  } catch (e) {}
})(__CONFIG__);
JS;
}
