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

namespace Ramon\Canela\Ai\Tools;

use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\Http\UrlGenerator;

/**
 * O endereço público de um tópico (e de um post dentro dele), para o bot
 * citar com links que funcionam.
 */
final class TopicLinks
{
    public function __construct(
        private readonly UrlGenerator $url,
        private readonly SlugManager $slugs,
    ) {
    }

    public function discussion(Discussion $discussion, ?int $near = null): string
    {
        $parameters = ['id' => $this->slugs->forResource(Discussion::class)->toSlug($discussion)];

        if ($near !== null && $near > 1) {
            $parameters['near'] = (string) $near;
        }

        return $this->url->to('forum')->route('discussion', $parameters);
    }
}
