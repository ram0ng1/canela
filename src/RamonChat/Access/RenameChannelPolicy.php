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

namespace Ramon\Canela\RamonChat\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;

/**
 * `$actor->can('canelaRename', $channel)`: mudar o nome do chat em grupo.
 *
 * O ramon/chat só deixa o moderador do chat editar uma MD (a política `edit`
 * dele); aqui basta ser participante ativo de uma MD que não está arquivada
 * nem excluída, com o recurso ligado no admin. `forceDeny` fora disso, para
 * a regra valer também para administradores, como antes.
 */
final class RenameChannelPolicy extends AbstractPolicy
{
    public const ABILITY = 'canelaRename';

    public function __construct(
        private readonly RamonChatSettings $settings,
    ) {
    }

    public function canelaRename(User $actor, Channel $channel): string
    {
        if ($actor->isGuest() || ! $this->settings->enabled('group_name') || $channel->deleted_at !== null || ! $channel->isDirect() || $channel->isArchived()) {
            return $this->forceDeny();
        }

        $member = ChannelUser::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', $actor->id)
            ->whereNull('left_at')
            ->where('hidden', false)
            ->exists();

        return $member ? $this->allow() : $this->forceDeny();
    }
}
