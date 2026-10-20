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
        [$rootClasses, $bgImage] = $this->background($attrs, $request);
        $classes = array_keys(array_filter([
            'Canela' => true,
            'Canela--pillButtons' => $bool('canelaPillButtons', true),
            'Canela--tinted' => ($attrs['canelaForumBackground'] ?? 'tinted') !== 'plain',
            'Canela--card' => $bool('canelaContentCard', true),
            'Canela--noSidebar' => ! $sidebar,
            'Canela--headerSearch' => $bool('canelaHeaderSearch', true),
            'Canela--noEventPosts' => ! $bool('canelaTopicEventPosts', false),
            // A linha do tempo ligando os avatares (less/forum/PostDirect.less).
            'Canela--postDirect' => ($attrs['canelaPostStyle'] ?? null) === 'direct',
        ]));

        $config = json_encode([
            'classes' => $classes,
            'root' => $rootClasses,
            'bgImage' => $bgImage,
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
        // A largura do cartão de conteúdo escolhida no admin, antes da primeira
        // pintura (aplicada no JS, o cartão mudaria de tamanho depois do boot).
        // Aceita px (960–1800) ou as opções "90%" e "100%" (largura toda).
        $raw = trim((string) $this->settings->get('canela.content_width'));
        $width = match (true) {
            $raw === '90%', $raw === '100%' => $raw,
            ctype_digit($raw) && (int) $raw >= 960 && (int) $raw <= 1800 && (int) $raw !== 1110 => ((int) $raw).'px',
            default => null,
        };

        if ($width !== null) {
            $document->head[] = '<style>:root{--cn-main-max:'.$width.'}</style>';
        }

        // Como no core, a escolha do visitante só vale com o padrão do fórum em "auto".
        if (($this->settings->get('color_scheme') ?? 'auto') === 'auto') {
            $document->head[] = '<script>'.self::THEME_SCRIPT.'</script>';
        }
    }

    /**
     * As classes do fundo no <html> e a imagem dele, como o
     * js/src/forum/shell/backgrounds.ts faz. Em /login, /signup e
     * /forgot-password (com as páginas ligadas) vale o fundo dessas páginas,
     * e o <html> ganha `CanelaAuthRoute`, que esconde o cabeçalho.
     *
     * @param array<array-key, mixed> $attrs
     * @return array{0: list<string>, 1: ?string}
     */
    private function background(array $attrs, ServerRequestInterface $request): array
    {
        $styles = ['tinted', 'gradient', 'solid', 'plain', 'image'];
        $pick = static fn (mixed $value, string $fallback): string => is_string($value) && in_array($value, $styles, true) ? $value : $fallback;

        $authPages = ($attrs['canelaAuthPages'] ?? true) !== false && ($attrs['canelaAuthRoutes'] ?? false) === true;
        $auth = $authPages && preg_match('#/(login|signup|forgot-password|reset/[^/]+)/?$#', $request->getUri()->getPath()) === 1;

        $style = $pick($attrs['canelaForumBackground'] ?? null, 'tinted');
        $image = $attrs['canelaForumBackgroundImage'] ?? null;

        if ($auth && in_array($attrs['canelaAuthBackground'] ?? null, $styles, true)) {
            $style = (string) $attrs['canelaAuthBackground'];
            $image = $attrs['canelaAuthBackgroundImage'] ?? null;
        }

        $base = $attrs['assetsBaseUrl'] ?? null;
        $url = $style === 'image' && is_string($image) && $image !== '' && is_string($base) ? rtrim($base, '/').'/'.$image : null;

        // Imagem escolhida e ainda não enviada: o liso.
        $classes = ['CanelaBg--'.($style === 'image' && $url === null ? 'plain' : $style)];

        if ($auth) {
            $classes[] = 'CanelaAuthRoute';
        }

        return [$classes, $url];
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
    // O fundo (CanelaBg--*), a página de entrar/cadastrar e os botões em
    // pílula leem classes no <html> (Core.less, Auth.less, Components.less):
    // já existem agora, antes do primeiro desenho do body.
    var root = document.documentElement.classList;
    root.add.apply(root, c.root);
    if (c.bgImage) document.documentElement.style.setProperty('--cn-bg-image', 'url(' + JSON.stringify(c.bgImage) + ')');
    if (c.classes.indexOf('Canela--pillButtons') >= 0) root.add('CanelaRoot--pill');
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
