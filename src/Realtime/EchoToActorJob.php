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

namespace Ramon\Canela\Realtime;

use Flarum\Post\Post;
use Flarum\Queue\AbstractJob;
use Flarum\Realtime\Push\Audience;
use Flarum\Realtime\Push\Jobs\SendGeneratedPayloadJob;
use Flarum\Realtime\Push\Payload\Generator;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Manda a quem agiu o mesmo aviso que o flarum/realtime manda aos outros.
 *
 * O realtime tira quem fez a ação da lista de destinatários (o pedido dele já
 * atualizou a aba em que clicou), e quem está logado só escuta o próprio
 * canal privado. Resultado: a curtida, a reação ou a edição feita numa aba
 * não aparecia nas outras abas e aparelhos da mesma conta, só depois de
 * recarregar. Agora todas se atualizam.
 *
 * O envio é o do próprio realtime (SendGeneratedPayloadJob: o post como essa
 * pessoa o vê, no canal privado dela) e só sai se ela estiver conectada: sem
 * outra aba aberta, não custa nada. A aba em que clicou também recebe; ela
 * só recarrega o tópico, e o que chega é o que ela já mostra.
 *
 * Com o servidor do websocket fora do ar, lembra disso por 30 s (como o me
 * too e o chat), para cada clique não pagar as tentativas de conexão.
 */
final class EchoToActorJob extends AbstractJob
{
    private const DOWN_KEY = 'canela.realtime.websocket_down';

    public function __construct(
        private readonly string $eventName,
        private readonly int $postId,
        private readonly int $actorId,
    ) {
        parent::__construct();
    }

    public function handle(Cache $cache): void
    {
        if (
            ! class_exists(SendGeneratedPayloadJob::class)
            || ! class_exists(Audience::class)
            || ! class_exists(Generator::class)
            || ! class_exists(\Pusher\Pusher::class)
            || $cache->get(self::DOWN_KEY)
        ) {
            return;
        }

        try {
            /** @var Audience $audience */
            $audience = resolve(Audience::class);
            $connected = $audience->connectedUserIds();

            if ($connected === null) {
                $this->markDown($cache, 'sem resposta do servidor do websocket');

                return;
            }

            if (! in_array($this->actorId, $connected, true)) {
                return;
            }

            $post = Post::query()->find($this->postId);
            $actor = User::query()->find($this->actorId);

            if (! $post || ! $actor) {
                return;
            }

            (new SendGeneratedPayloadJob($this->eventName, $post, $actor))
                ->handle(resolve(Generator::class), resolve(\Pusher\Pusher::class));
        } catch (\Throwable $error) {
            // Por nome: o pusher/pusher-php-server só existe com o flarum/realtime.
            $message = $error->getMessage();

            if (is_a($error, 'Pusher\PusherException') || $error instanceof \GuzzleHttp\Exception\TransferException) {
                $this->markDown($cache, $message);
            } else {
                error_log('[ramon/canela] realtime: envio a quem agiu falhou: '.$message);
            }
        }
    }

    private function markDown(Cache $cache, string $reason): void
    {
        $cache->put(self::DOWN_KEY, true, 30);
        error_log('[ramon/canela] realtime: websocket indisponível: '.$reason);
    }
}
