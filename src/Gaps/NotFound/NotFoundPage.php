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

namespace Ramon\Canela\Gaps\NotFound;

use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Support\Collection;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Support\NullOrder;
use Ramon\Canela\Theme\FontFamily;

/**
 * Os dados da página 404 ("Oops! Essa página não existe ou é
 * privada."): o modelo escolhido no admin, logo, cor, a fonte do tema e os
 * tópicos populares e recentes.
 *
 * A página de erro é desenhada sem a requisição (o ViewFormatter do core
 * não a repassa), então os tópicos são os que um visitante veria — o que
 * também evita mostrar, numa página de erro, algo restrito.
 *
 * Qualquer falha aqui volta para a página do core: a página de erro não
 * pode, ela mesma, dar erro.
 */
final class NotFoundPage
{
    private const COUNT = 5;

    /** Só um hexadecimal entra num `style`: as cores vêm do banco. */
    private const HEX = '/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i';

    /** Família do CSS e arquivos (latin, latin-ext) de cada fonte do tema (less/fonts.less). */
    private const FONTS = [
        FontFamily::INTER => ['Inter', 'inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'],
        FontFamily::JAKARTA => ['Plus Jakarta Sans', 'plus-jakarta-sans-latin-wght-normal.woff2', 'plus-jakarta-sans-latin-ext-wght-normal.woff2'],
    ];

    public function __construct(
        private readonly GapsSettings $gaps,
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
        private readonly ExtensionManager $extensions,
        private readonly Factory $filesystem,
    ) {
    }

    public function enabled(): bool
    {
        return $this->gaps->on(GapsSettings::NOT_FOUND);
    }

    /** @return array<string, mixed>|null */
    public function data(): ?array
    {
        try {
            $base = rtrim($this->url->to('forum')->base(), '/');
            $logo = $this->settings->get('logo_path');

            // O endereço público vem do disco de assets (CDN, S3...); um disco
            // que não sabe dar URL fica com o /assets do fórum.
            $disk = $this->filesystem->disk('flarum-assets');
            $asset = fn (string $path): string => $disk instanceof Cloud ? $disk->url($path) : $base.'/assets/'.$path;

            return [
                'template' => $this->gaps->notFoundTemplate(),
                'base' => $base,
                'title' => (string) $this->settings->get('forum_title'),
                'logo' => $logo ? $asset((string) $logo) : null,
                'color' => $this->color(),
                'font' => $this->font(fn (string $file) => $asset('extensions/ramon-canela/fonts/'.$file)),
                'popular' => $this->topics('popular'),
                'recent' => $this->topics('recent'),
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    private function color(): string
    {
        $color = (string) $this->settings->get('theme_primary_color', '#4d698e');

        return preg_match(self::HEX, $color) ? $color : '#4d698e';
    }

    /**
     * A mesma fonte do fórum (a do admin): a família e os arquivos para o
     * `@font-face`. Com a do sistema, só a pilha de fontes do sistema.
     *
     * @param callable(string): string $url
     *
     * @return array{family: ?string, latin: ?string, latinExt: ?string}
     */
    private function font(callable $url): array
    {
        $choice = (new FontFamily())($this->settings->get(FontFamily::SETTING));
        $font = self::FONTS[$choice] ?? null;

        return [
            'family' => $font[0] ?? null,
            'latin' => $font ? $url($font[1]) : null,
            'latinExt' => $font ? $url($font[2]) : null,
        ];
    }

    /** @return list<array{title: string, url: string, tag: ?string, color: ?string}> */
    private function topics(string $kind): array
    {
        $query = Discussion::query()
            ->whereVisibleTo(new Guest())
            ->where('is_private', false)
            ->whereNull('hidden_at');

        if ($kind === 'popular') {
            NullOrder::orderBy($query->orderByDesc('comment_count'), 'last_posted_at', 'desc');
        } else {
            $query->orderByDesc('created_at');
        }

        /** @var Collection<int, Discussion> $discussions */
        $discussions = $query->limit(self::COUNT)->get();
        $tags = $this->extensions->isEnabled('flarum-tags');

        return $discussions->map(function (Discussion $discussion) use ($tags) {
            $tag = $tags ? $discussion->tags()->whereNull('parent_id')->whereNotNull('position')->first() : null;

            return [
                'title' => (string) $discussion->title,
                'url' => $this->url->to('forum')->route('discussion', ['id' => $discussion->id.'-'.$discussion->slug]),
                'tag' => $tag?->name,
                'color' => $tag && preg_match(self::HEX, (string) $tag->color) ? (string) $tag->color : null,
            ];
        })->values()->all();
    }
}
