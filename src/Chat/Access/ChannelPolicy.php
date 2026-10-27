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

namespace Ramon\Canela\Chat\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Model\Channel;

/**
 * O que o ator pode num canal (`$actor->can('…', $channel)`).
 *
 * - `view`: o canal avulso, todo mundo que usa o chat; o de uma tag, quem
 *   enxerga a tag; a MD, só os participantes.
 * - `moderate`: a moderação do chat, só nos canais públicos — numa MD não há
 *   moderação, e quem modera o fórum não lê as conversas dos outros.
 * - `edit` e `addMembers`: a moderação, ou qualquer participante de um grupo
 *   de MD. `delete`: a moderação.
 * - `post`: escrever (o motivo de não poder vem do ChatAccess::cannotPostReason).
 * - `pin`: com as fixadas ligadas e o canal não arquivado, a moderação nos
 *   públicos e qualquer participante numa MD.
 *
 * Tudo além de `view` pede também `view` (pelo Gate, e não pelo método
 * daqui): o canal que outra extensão esconde do ator não aceita a escrita,
 * a fixação nem a moderação dele.
 *
 * Fora das MDs, o "não" é `deny`, que outra policy pode virar com
 * `forceAllow`. A MD alheia é `forceDeny`: sem ele o Gate deixaria passar os
 * administradores, e nem eles leem as MDs dos outros.
 */
final class ChannelPolicy extends AbstractPolicy
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    public function view(User $actor, Channel $channel): string
    {
        if (! $this->access->canUse($actor)) {
            return $this->deny();
        }

        if ($channel->isDirect()) {
            return $this->access->membership($channel, $actor) ? $this->allow() : $this->forceDeny();
        }

        if ($channel->tag_id === null) {
            return $this->allow();
        }

        $tagIds = $this->access->visibleTagIds($actor);

        return $tagIds === null || in_array($channel->tag_id, $tagIds, true) ? $this->allow() : $this->deny();
    }

    public function moderate(User $actor, Channel $channel): bool
    {
        return $channel->isPublic() && $this->access->canModerate($actor) && $actor->can('view', $channel);
    }

    public function edit(User $actor, Channel $channel): bool
    {
        return $this->moderate($actor, $channel) || $this->inGroupDm($actor, $channel);
    }

    public function addMembers(User $actor, Channel $channel): bool
    {
        return $this->edit($actor, $channel);
    }

    public function delete(User $actor, Channel $channel): bool
    {
        return $this->moderate($actor, $channel);
    }

    public function post(User $actor, Channel $channel): bool
    {
        return $actor->can('view', $channel)
            && $this->access->cannotPostReason($channel, $actor, $this->access->membership($channel, $actor)) === null;
    }

    public function pin(User $actor, Channel $channel): bool
    {
        if (! $this->access->settings()->bool(ChatSettings::PINS_ENABLED) || $channel->status === Channel::STATUS_ARCHIVED) {
            return false;
        }

        return $channel->isDirect() ? $this->access->membership($channel, $actor) !== null && $actor->can('view', $channel) : $this->moderate($actor, $channel);
    }

    private function inGroupDm(User $actor, Channel $channel): bool
    {
        return $channel->isDirect() && $channel->is_group && $this->access->membership($channel, $actor) !== null && $actor->can('view', $channel);
    }
}
