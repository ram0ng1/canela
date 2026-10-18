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

namespace Ramon\Canela\Badges\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\User\User;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\TrustLevel\TrustLevel;

/**
 * O nível de confiança no usuário: `trustLevel` para todos (o perfil mostra
 * "Nível de confiança: membro"), `trustLevelLocked` só para o admin.
 *
 * O admin pode escolher o nível à mão — é o único caminho para o 4 (Líder).
 * Escolher à mão também fixa o nível, como o "bloquear nível de confiança" do
 * Discourse: sem isso, o comando diário rebaixaria o Regular escolhido na hora.
 */
final class UserResourceFields
{
    public function __construct(
        private readonly BadgeSettings $settings,
    ) {
    }

    public function __invoke(): array
    {
        $isAdmin = fn (User $user, Context $context) => $context->getActor()->isAdmin();

        return [
            Schema\Integer::make('trustLevel')
                ->visible(fn () => $this->settings->trustLevelsEnabled())
                ->get(fn (User $user) => (int) ($user->getAttribute('canela_trust_level') ?? 0))
                ->writable($isAdmin)
                ->rule('min:'.TrustLevel::MIN)
                ->rule('max:'.TrustLevel::MAX)
                ->set(function (User $user, int $level) {
                    if ((int) $user->getAttribute('canela_trust_level') === $level) {
                        return;
                    }

                    $user->setAttribute('canela_trust_level', $level);
                    $user->setAttribute('canela_trust_level_at', Carbon::now());
                    $user->setAttribute('canela_trust_level_locked', true);

                    $user->afterSave(fn (User $saved) => resolve(BadgeGranter::class)->trustLevelChanged($saved));
                }),

            Schema\Boolean::make('trustLevelLocked')
                ->visible(fn (User $user, Context $context) => $this->settings->trustLevelsEnabled() && $context->getActor()->isAdmin())
                ->get(fn (User $user) => (bool) $user->getAttribute('canela_trust_level_locked'))
                ->writable($isAdmin)
                ->set(fn (User $user, bool $locked) => $user->setAttribute('canela_trust_level_locked', $locked)),
        ];
    }
}
