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

namespace Ramon\Canela\Bookmarks\Listener;

use Flarum\Post\Event\Deleted;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Bookmarks\Bookmark;

/**
 * Apaga os marcadores de um post apagado.
 *
 * A tabela tem `cascadeOnDelete()` no `post_id`, mas o SQLite só aplica
 * chaves estrangeiras com `PRAGMA foreign_keys` ligado — e ele vem desligado
 * em cada conexão nova. Sem isto, o marcador ficaria órfão. Como no
 * fof/bookmarks, roda junto com a cascata: onde ela já apagou, não apaga nada.
 */
final class DeleteBookmarksOnPostDeletion
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    public function handle(Deleted $event): void
    {
        $this->db->table((new Bookmark())->getTable())
            ->where('post_id', $event->post->id)
            ->delete();
    }
}
