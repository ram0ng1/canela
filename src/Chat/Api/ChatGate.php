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

namespace Ramon\Canela\Chat\Api;

use Flarum\Api\Context;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Ramon\Canela\Chat\ChatAccess;

/**
 * A porta de todo endpoint do chat, no `before` dos recursos e no começo das
 * ações: o chat ligado no admin (senão 404, como se ele não existisse), um
 * usuário logado (401) que pode usar o chat (403).
 *
 * As rotas são montadas no boot, antes das configurações: com o chat
 * desligado elas continuam registradas, e é aqui que respondem 404.
 */
final class ChatGate
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    /**
     * @throws ModelNotFoundException
     * @throws \Flarum\User\Exception\NotAuthenticatedException
     * @throws \Flarum\User\Exception\PermissionDeniedException
     */
    public function __invoke(Context $context): void
    {
        $this->access->settings()->assertEnabled();

        $actor = $context->getActor();
        $actor->assertRegistered();

        $this->access->assertCanUse($actor);
    }

    public static function check(Context $context): void
    {
        resolve(self::class)($context);
    }
}
