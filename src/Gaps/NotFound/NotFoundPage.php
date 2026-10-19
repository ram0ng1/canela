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
use Illuminate\Support\Collection;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Support\NullOrder;

/**
 * Os dados da página 404 do Discourse ("Oops! Essa página não existe ou é
 * privada."): logo, cor, os tópicos populares e os recentes.
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

    public function __construct(
        private readonly GapsSettings $gaps,
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
        private readonly ExtensionManager $extensions,
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

            return [
                'base' => $base,
                'title' => (string) $this->settings->get('forum_title'),
                'logo' => $logo ? $base.'/assets/'.$logo : null,
                'color' => (string) $this->settings->get('theme_primary_color', '#4d698e'),
                'popular' => $this->topics('popular'),
                'recent' => $this->topics('recent'),
            ];
        } catch (\Throwable) {
            return null;
        }
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
                'color' => $tag?->color ?: null,
            ];
        })->values()->all();
    }
}
