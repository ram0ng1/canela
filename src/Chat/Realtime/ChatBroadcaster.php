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

namespace Ramon\Canela\Chat\Realtime;

use Flarum\Extension\ExtensionManager;
use Illuminate\Contracts\Queue\Queue;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;

/**
 * Entrega em tempo real pelo websocket do flarum/realtime.
 *
 * O realtime não deixa uma extensão autorizar canais próprios do Pusher (o
 * AuthController dele só conhece os seus), mas cada usuário logado já assina o
 * canal privado `private-user={id}`. O chat publica ali o evento `canelaChat`,
 * só para quem participa do canal — a autorização é a própria lista de membros.
 *
 * Sem o flarum/realtime (ou com o servidor dele fora do ar) nada é enviado e o
 * fórum cai no polling: o front pergunta a cada poucos segundos o que mudou.
 */
final class ChatBroadcaster
{
    public const EVENT = 'canelaChat';

    public function __construct(
        private readonly ExtensionManager $extensions,
        private readonly Queue $queue,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('flarum-realtime') && class_exists(\Pusher\Pusher::class);
    }

    /**
     * @param int[] $userIds
     * @param array<string, mixed> $payload
     */
    public function send(array $userIds, array $payload): void
    {
        $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));

        if (! $userIds || ! $this->available()) {
            return;
        }

        try {
            $this->queue->push(new ChatPushJob($userIds, $payload));
        } catch (\Throwable $error) {
            // A mensagem já foi gravada: falhar a entrega não pode falhar o envio.
            error_log('[ramon/canela] chat: entrega em tempo real falhou: '.$error->getMessage());
        }
    }

    /**
     * Quem recebe os eventos de um canal: os membros que entraram nele — e, numa
     * MD, todos os participantes, porque uma mensagem nova traz de volta a
     * conversa para quem a tinha fechado.
     *
     * @return int[]
     */
    public function audience(Channel $channel, ?int $except = null): array
    {
        $query = Membership::query()->where('channel_id', $channel->id);

        if (! $channel->isDirect()) {
            $query->where('following', true);
        }

        if ($except) {
            $query->where('user_id', '<>', $except);
        }

        return $query->pluck('user_id')->map(static fn ($id) => (int) $id)->all();
    }

    /** @param array<string, mixed> $payload */
    public function toChannel(Channel $channel, array $payload, ?int $except = null): void
    {
        $this->send($this->audience($channel, $except), $payload + ['channelId' => $channel->id]);
    }
}
