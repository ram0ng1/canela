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
use Ramon\Canela\Ai\Conversation;

/**
 * Conversas com o bot são pessoais: só a dona vê, renomeia, continua e
 * apaga.
 *
 * `forceDeny` para os outros, e não `deny`: sem ele o Gate deixaria passar os
 * administradores, e nem eles leem as conversas dos outros.
 */
final class ConversationPolicy extends AbstractPolicy
{
    public function view(User $actor, Conversation $conversation): string
    {
        return $this->ownerOnly($actor, $conversation);
    }

    /** Mandar uma pergunta nova na conversa (ReplyController). */
    public function reply(User $actor, Conversation $conversation): string
    {
        return $this->ownerOnly($actor, $conversation);
    }

    public function edit(User $actor, Conversation $conversation): string
    {
        return $this->ownerOnly($actor, $conversation);
    }

    public function delete(User $actor, Conversation $conversation): string
    {
        return $this->ownerOnly($actor, $conversation);
    }

    private function ownerOnly(User $actor, Conversation $conversation): string
    {
        return ! $actor->isGuest() && $conversation->user_id === (int) $actor->id ? $this->allow() : $this->forceDeny();
    }
}
