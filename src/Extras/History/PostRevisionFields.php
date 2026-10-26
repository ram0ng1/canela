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

namespace Ramon\Canela\Extras\History;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Ramon\Canela\Extras\Extras;

/**
 * `canelaRevisionCount` na postagem: quantas edições o histórico guardou, o
 * número ao lado do lápis no cabeçalho do post.
 *
 * Conta pela relação (um COUNT agrupado para a página inteira de postagens, e
 * não uma consulta por post). Com o recurso desligado (ou o histórico fechado
 * para quem lê) o atributo some, e o fórum volta ao "Editado" do core.
 */
final class PostRevisionFields
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * @return array<Schema\Integer>
     */
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('canelaRevisionCount')
                ->countRelation('canelaRevisions')
                ->visible(fn (Post $post, Context $context): bool => $post instanceof CommentPost
                    && Extras::canSeeHistory($this->settings, $context->getActor(), $post)),
        ];
    }
}
