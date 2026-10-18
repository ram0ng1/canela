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

namespace Ramon\Canela\Gaps\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Tags\Tag;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Gaps\UnreadTags;

/**
 * `canelaHasUnread` na tag: o ponto de novidades da categoria na barra
 * lateral. A tag mãe acende junto com a filha, como no Discourse.
 */
final class TagResourceFields
{
    public function __construct(
        private readonly UnreadTags $unread,
        private readonly GapsSettings $gaps,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canelaHasUnread')
                ->visible(fn (Tag $tag, Context $context) => ! $context->getActor()->isGuest() && $this->gaps->on(GapsSettings::CATEGORY_UNREAD))
                ->get(fn (Tag $tag, Context $context) => isset($this->unread->for($context->getActor())[(int) $tag->id])),
        ];
    }
}
