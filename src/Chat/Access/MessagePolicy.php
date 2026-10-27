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
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;

/**
 * O que o ator pode numa mensagem (`$actor->can('…', $message)`).
 *
 * - `view`: quem enxerga o canal; apagada, só o autor e a moderação.
 * - `edit`: o autor, enquanto o canal aceita a escrita dele — nem a moderação
 *   edita a mensagem dos outros.
 * - `delete`: a moderação (fora dos canais arquivados e somente leitura), ou
 *   o autor não suspenso num canal aberto.
 * - `restore`: a moderação, ou o autor quando foi ele mesmo quem apagou.
 * - `react`: a mesma permissão de escrever no canal.
 * - `pin`: a de fixar no canal, numa mensagem que não foi apagada.
 *
 * O canal vem da relação `channel`: quem monta uma lista a preenche antes
 * (setRelation), para não carregar o mesmo canal uma vez por mensagem.
 */
final class MessagePolicy extends AbstractPolicy
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    public function view(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        if (! $channel || ! $actor->can('view', $channel)) {
            return false;
        }

        return ! $message->isDeleted() || $this->access->canSeeDeleted($message, $channel, $actor);
    }

    public function edit(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        return $channel !== null
            && ! $message->isDeleted()
            && $message->user_id !== null
            && $message->user_id === $actor->id
            && $actor->can('post', $channel);
    }

    public function delete(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        if (! $channel || $message->isDeleted() || $channel->status === Channel::STATUS_ARCHIVED || $channel->status === Channel::STATUS_READ_ONLY) {
            return false;
        }

        if ($actor->can('moderate', $channel)) {
            return true;
        }

        return $message->user_id === $actor->id && ! $this->access->isSuspended($actor) && $channel->status === Channel::STATUS_OPEN;
    }

    public function restore(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        if (! $channel || ! $message->isDeleted()) {
            return false;
        }

        $moderates = $actor->can('moderate', $channel);

        if ($channel->status !== Channel::STATUS_OPEN && ! $moderates) {
            return false;
        }

        return $moderates || ($message->user_id === $actor->id && $message->deleted_by_id === $actor->id);
    }

    public function react(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        return $channel !== null && ! $message->isDeleted() && $actor->can('post', $channel);
    }

    public function pin(User $actor, Message $message): bool
    {
        $channel = $this->channel($message);

        return $channel !== null && ! $message->isDeleted() && $actor->can('pin', $channel);
    }

    private function channel(Message $message): ?Channel
    {
        /** @var Channel|null */
        return $message->channel;
    }
}
