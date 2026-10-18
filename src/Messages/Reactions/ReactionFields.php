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

namespace Ramon\Canela\Messages\Reactions;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Messages\DialogMessage;

/**
 * As reações de cada mensagem privada: as contagens por reação e a minha.
 * Ficam de fora sem a tabela, e o fórum esconde o botão.
 */
final class ReactionFields
{
    public function __construct(
        private readonly MessageReactions $reactions,
    ) {
    }

    /**
     * @return array<int, Schema\Attribute>
     */
    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaReactions')
                ->visible(fn (): bool => $this->reactions->enabled())
                ->get(fn (DialogMessage $message, Context $context): array => $this->reactions->summary((int) $message->id, $context->getActor())),
        ];
    }
}
