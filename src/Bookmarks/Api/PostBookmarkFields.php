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

namespace Ramon\Canela\Bookmarks\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Post\Post;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\Bookmarks\BookmarksFeature;

/**
 * O marcador do ator em cada post: o botão do post precisa saber se está
 * marcado, e o "Editar marcador" abre já preenchido sem ir buscar o marcador.
 *
 * Só para quem está logado e com o recurso ligado — para os outros os campos
 * nem aparecem. Os valores saem do BookmarkBuffer, numa consulta por resposta.
 */
final class PostBookmarkFields
{
    public function __invoke(): array
    {
        $visible = static fn (Post $post, Context $context): bool => ! $context->getActor()->isGuest() && BookmarksFeature::enabled();

        $bookmark = static fn (Post $post, Context $context) => BookmarkBuffer::defer($context->getActor()->id, $post->id);

        // Cada campo pega o mesmo marcador adiado e lê uma parte dele.
        $read = static fn (callable $pick) => static function (Post $post, Context $context) use ($bookmark, $pick) {
            $resolve = $bookmark($post, $context);

            return static fn () => $pick($resolve());
        };

        return [
            Schema\Boolean::make('bookmarked')
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): bool => $found !== null)),

            Schema\Integer::make('bookmarkId')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): ?int => $found?->id)),

            Schema\Str::make('bookmarkName')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): ?string => $found?->name)),

            Schema\DateTime::make('bookmarkReminderAt')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found) => $found?->reminder_at)),
        ];
    }
}
