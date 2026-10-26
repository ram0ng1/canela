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
use Ramon\Canela\Gaps\Invites\InviteService;

/**
 * O que o fórum precisa saber do backend dos recursos (gaps) para quem está
 * vendo: se pode gerar convites e se tem convites para revogar.
 */
final class ForumResourceFields
{
    public function __construct(
        private readonly InviteService $invites,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canelaCanInvite')
                ->get(fn (object $forum, Context $context) => $this->invites->canCreate($context->getActor())),
            // Quem não pode mais convidar, mas ainda tem convites: o fórum
            // mostra a janela só para listar e revogar.
            Schema\Boolean::make('canelaHasInvites')
                ->get(fn (object $forum, Context $context) => $this->invites->hasInvites($context->getActor())),
        ];
    }
}
