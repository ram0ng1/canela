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

namespace Ramon\Canela\Community;

use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use FoF\Pages\Page;
use FoF\Pages\Util\Html;

/**
 * As páginas do fof/pages que o admin pôs como abas extras da área Sobre
 * (setting `canela.about_pages`, uma lista JSON de `{id, label, icon}` na
 * ordem das abas). Só as páginas da lista abrem pelas rotas do tema, e sempre
 * com a visibilidade do próprio fof/pages. Sem o fof/pages, a lista é vazia.
 */
final class AboutPages
{
    /** Mais que isso não cabe como abas, e o JSON do setting fica pequeno. */
    public const MAX = 20;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('fof-pages') && class_exists(Page::class);
    }

    /**
     * As abas extras são parte da área Sobre: com o Sobre desligado no admin
     * elas somem junto (lista vazia no fórum, 404 na API e no /about/{id}),
     * como o próprio /about.
     */
    public function enabled(): bool
    {
        return (bool) $this->settings->get(Community::ABOUT_ENABLED) && $this->available();
    }

    /**
     * A lista do admin, já limpa (ids inteiros e únicos, no máximo MAX).
     *
     * @return list<array{id: int, label: string, icon: string}>
     */
    public function entries(): array
    {
        return self::parse($this->settings->get(Community::ABOUT_PAGES));
    }

    /**
     * As abas que o ator vê, na ordem do admin: só páginas que existem e que o
     * fof/pages deixa ele ver. Vai no payload do fórum, por isso só o
     * necessário para desenhar a aba e montar a URL.
     *
     * @return list<array{id: int, label: string, slug: string, icon: string}>
     */
    public function forForum(User $actor): array
    {
        $entries = $this->entries();

        if ($entries === [] || ! $this->enabled()) {
            return [];
        }

        $pages = Page::query()
            ->whereVisibleTo($actor)
            ->whereIn('id', array_column($entries, 'id'))
            ->get(['id', 'title', 'slug'])
            ->keyBy('id');

        $tabs = [];

        foreach ($entries as $entry) {
            $page = $pages->get($entry['id']);

            if (! $page instanceof Page) {
                continue;
            }

            $tabs[] = [
                'id' => $entry['id'],
                'label' => $entry['label'] !== '' ? $entry['label'] : (string) $page->title,
                'slug' => self::slug((string) $page->slug),
                'icon' => $entry['icon'],
            ];
        }

        return $tabs;
    }

    /** A página, se estiver na lista do admin e o ator puder vê-la. */
    public function find(User $actor, int $id): ?Page
    {
        if ($id <= 0 || ! $this->enabled() || ! in_array($id, array_column($this->entries(), 'id'), true)) {
            return null;
        }

        $page = Page::query()->whereVisibleTo($actor)->find($id);

        return $page instanceof Page ? $page : null;
    }

    /** O rótulo da aba (o do admin ou o título da página). */
    public function label(Page $page): string
    {
        foreach ($this->entries() as $entry) {
            if ($entry['id'] === (int) $page->id && $entry['label'] !== '') {
                return $entry['label'];
            }
        }

        return (string) $page->title;
    }

    public function html(Page $page): string
    {
        return Html::render($page->content_html, $page);
    }

    /**
     * O id no começo do parâmetro da rota (`3-regras` → 3), como o `/d/{id}`
     * do core: o slug é só enfeite e pode mudar sem quebrar links.
     */
    public static function idFromParam(string $param): int
    {
        return preg_match('/^(\d+)/', $param, $match) ? (int) $match[1] : 0;
    }

    /**
     * O valor do setting no formato certo, para guardar. Qualquer coisa que
     * não seja uma lista de objetos com id inteiro positivo é descartada: o
     * admin manda JSON, mas a API de settings aceita qualquer texto.
     */
    public static function normalize(mixed $raw): string
    {
        return (string) json_encode(self::parse($raw), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** @return list<array{id: int, label: string, icon: string}> */
    private static function parse(mixed $raw): array
    {
        $items = is_string($raw) ? json_decode($raw, true) : $raw;

        if (! is_array($items)) {
            return [];
        }

        $out = [];
        $seen = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $id = filter_var($item['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

            if ($id === false || isset($seen[$id])) {
                continue;
            }

            $seen[$id] = true;
            $label = is_string($item['label'] ?? null) ? trim(strip_tags($item['label'])) : '';
            $icon = is_string($item['icon'] ?? null) ? trim($item['icon']) : '';

            $out[] = [
                'id' => $id,
                'label' => mb_substr($label, 0, 60),
                // Só classes do Font Awesome ("fas fa-scale-balanced"): o ícone vira
                // atributo `class`, e nada além de letras, números e hífens entra lá.
                'icon' => preg_match('/^[a-z0-9 -]{1,60}$/i', $icon) ? $icon : '',
            ];

            if (count($out) >= self::MAX) {
                break;
            }
        }

        return $out;
    }

    /** O slug seguro para a URL (o do fof/pages pode vir vazio ou com espaços). */
    private static function slug(string $slug): string
    {
        return trim((string) preg_replace('/[^\pL\pN_-]+/u', '-', $slug), '-');
    }
}
