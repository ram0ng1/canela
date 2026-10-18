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

use Flarum\Queue\AbstractJob;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Str;

/**
 * Publica um evento do chat nos canais `private-user={id}` de quem está
 * conectado agora.
 *
 * - Pergunta primeiro ao servidor do websocket quem está conectado: num canal
 *   com milhares de membros, só os conectados recebem algo.
 * - O Pusher aceita até 100 canais por envio, então a lista vai em lotes.
 * - O limite de um evento é 10 KB: uma mensagem longa vai só como aviso
 *   (`refetch`), e o fórum busca o resto pela API.
 * - Servidor fora do ar: lembra disso por 30 s, para cada mensagem enviada não
 *   pagar o tempo das tentativas de conexão (o cliente do realtime repete duas
 *   vezes antes de desistir).
 */
final class ChatPushJob extends AbstractJob
{
    private const DOWN_KEY = 'canela.chat.websocket_down';

    private const MAX_PAYLOAD_BYTES = 9000;

    /**
     * @param int[] $userIds
     * @param array<string, mixed> $payload
     */
    public function __construct(
        private readonly array $userIds,
        private readonly array $payload,
    ) {
        parent::__construct();
    }

    public function handle(Cache $cache): void
    {
        if (! class_exists(\Pusher\Pusher::class) || $cache->get(self::DOWN_KEY)) {
            return;
        }

        try {
            /** @var \Pusher\Pusher $pusher */
            $pusher = resolve(\Pusher\Pusher::class);

            $response = $pusher->getChannels(['filter_by_prefix' => 'private-user=']);
            $connected = [];

            foreach ((array) ($response->channels ?? []) as $name => $channel) {
                $connected[(int) Str::after((string) $name, 'private-user=')] = true;
            }

            $recipients = array_values(array_filter($this->userIds, static fn (int $id) => isset($connected[$id])));

            if (! $recipients) {
                return;
            }

            $payload = $this->payload;

            if (strlen((string) json_encode($payload)) > self::MAX_PAYLOAD_BYTES) {
                $payload = array_intersect_key($payload, array_flip(['type', 'channelId', 'threadId', 'messageId', 'userId'])) + ['refetch' => true];
            }

            foreach (array_chunk($recipients, 100) as $chunk) {
                $pusher->trigger(array_map(static fn (int $id) => 'private-user='.$id, $chunk), ChatBroadcaster::EVENT, $payload);
            }
        } catch (\Throwable $error) {
            $cache->put(self::DOWN_KEY, true, 30);
            error_log('[ramon/canela] chat: websocket indisponível, usando polling: '.$error->getMessage());
        }
    }
}
