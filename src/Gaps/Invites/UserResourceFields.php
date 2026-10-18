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

namespace Ramon\Canela\Gaps\Invites;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\User\User;

/**
 * `canelaInviteCode` no cadastro: o fórum manda o código do convite junto
 * dos dados de quem se cadastra, e o resgate acontece depois que o usuário
 * foi gravado (antes ele ainda não tem id para guardar quem convidou).
 */
final class UserResourceFields
{
    public function __construct(
        private readonly InviteService $invites,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Str::make('canelaInviteCode')
                ->visible(false)
                ->nullable()
                ->maxLength(40)
                ->writable(fn (User $user, Context $context) => $context->creating())
                ->set(function (User $user, ?string $code) {
                    if (! $code || ! $this->invites->enabled()) {
                        return;
                    }

                    $user->afterSave(fn (User $saved) => $this->invites->redeem($code, $saved));
                }),
        ];
    }
}
