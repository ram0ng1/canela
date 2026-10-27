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

namespace Ramon\Canela\Templates\Listener;

use Flarum\Tags\Event\Deleting;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Templates\Template;
use Ramon\Canela\Templates\TemplateIndex;

/**
 * A tag apagada sai dos modelos em que valia (a tabela de ligação não tem
 * chave estrangeira para `tags`), e o índice do fórum é refeito. Um modelo
 * que só valia nela fica sem tag, isto é, passa a valer em qualquer tópico
 * novo, como mostra o painel.
 */
final class PruneDeletedTag
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly TemplateIndex $index,
    ) {
    }

    public function handle(Deleting $event): void
    {
        $removed = $this->db->table(Template::PIVOT)->where('tag_id', $event->tag->id)->delete();

        if ($removed > 0) {
            $this->index->rebuild();
        }
    }
}
