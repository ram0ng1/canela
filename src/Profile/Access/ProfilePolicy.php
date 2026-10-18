<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile\Access;

use Carbon\Carbon;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Profile\ProfileSettings;

/**
 * Quem edita o perfil estendido de quem.
 *
 * - `canelaEditProfile`: o próprio usuário, ou quem pode editar usuários
 *   (`user.edit`, a moderação). Um suspenso não edita o próprio perfil — a
 *   bio e o site seriam o jeito de continuar falando enquanto suspenso.
 * - `canelaEditTitle`: o título é uma distinção. Quando o admin tira do
 *   usuário a escolha, só a moderação define.
 *
 * Nos dois casos, quem não se encaixa recebe `deny()` em vez de `null`: o
 * Gate do core libera tudo para o admin quando nenhuma política decide, e
 * aqui o admin já entra pelo `edit`.
 */
final class ProfilePolicy extends AbstractPolicy
{
    public function __construct(
        private readonly ProfileSettings $settings
    ) {
    }

    public function canelaEditProfile(User $actor, User $user): string
    {
        if ($actor->isGuest() || ! $this->settings->enabled()) {
            return $this->deny();
        }

        if ($actor->id === $user->id) {
            return $this->isSuspended($actor) ? $this->deny() : $this->allow();
        }

        return $actor->can('edit', $user) ? $this->allow() : $this->deny();
    }

    public function canelaEditTitle(User $actor, User $user): string
    {
        if ($actor->isGuest() || ! $this->settings->fieldEnabled(ProfileSettings::TITLE)) {
            return $this->deny();
        }

        if ($actor->id !== $user->id) {
            return $actor->can('edit', $user) ? $this->allow() : $this->deny();
        }

        if ($this->settings->titleSelfEditable() && ! $this->isSuspended($actor)) {
            return $this->allow();
        }

        // Um moderador continua podendo trocar o próprio título.
        return $actor->can('edit', $user) ? $this->allow() : $this->deny();
    }

    /** A coluna só existe com o flarum/suspend; sem ele, ninguém está suspenso. */
    private function isSuspended(User $actor): bool
    {
        $until = $actor->getAttribute('suspended_until');

        if ($until === null) {
            return false;
        }

        return Carbon::parse($until)->isFuture();
    }
}
