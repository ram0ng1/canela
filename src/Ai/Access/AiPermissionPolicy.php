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

namespace Ramon\Canela\Ai\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Ai\AiSettings;

/**
 * As duas permissões globais da IA, `canela.useAi` e
 * `canela.generateAiSummaries`, para `$actor->can(...)`.
 *
 * Sem esta política o Gate só olharia a `group_permission` (e daria tudo ao
 * administrador). Aqui entram também o estado do recurso (IA no ar, resumo
 * ligado) e a conta (visitante e suspenso não usam): `forceDeny` nesses
 * casos, para nem o administrador passar — é o mesmo que valia antes das
 * permissões, quando o acesso era por lista de grupos nas configurações.
 */
final class AiPermissionPolicy extends AbstractPolicy
{
    public function __construct(
        private readonly AiSettings $settings,
    ) {
    }

    public function can(User $actor, string $ability): ?string
    {
        return match ($ability) {
            AiSettings::USE_PERMISSION => $this->settings->canUse($actor) ? $this->allow() : $this->forceDeny(),
            AiSettings::SUMMARIZE_PERMISSION => $this->settings->canSummarize($actor) ? $this->allow() : $this->forceDeny(),
            default => null,
        };
    }
}
