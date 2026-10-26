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

namespace Ramon\Canela\MeToo\Realtime;

use Flarum\Discussion\Discussion;
use Flarum\Queue\AbstractJob;
use Flarum\Realtime\Push\Audience;
use Flarum\User\Guest;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Ramon\Canela\MeToo\MeToo;
use Ramon\Canela\Support\Log;

/**
 * Publica `canelaMeToo` `{discussionId, count}` pelo websocket do
 * flarum/realtime.
 *
 * Por que não o `broadcastModelEvent` do realtime: ele refaz, para cada
 * conectado, um GET /discussions/{id} inteiro (com os posts) só para levar um
 * número. A contagem é a mesma para todos — o "eu marquei" de cada um não muda
 * quando outra pessoa clica —, então basta um envio com o mesmo payload para
 * todos os canais. A visibilidade é a do próprio realtime (o Audience, o
 * mesmo que ele usa para avisar que um post sumiu):
 *
 * - logado só assina o `private-user={id}`: recebe quem está conectado e pode
 *   ver o tópico; um tópico que o visitante vê, todo membro vê (a mesma
 *   premissa do Audience::snapshot);
 * - o canal `public` (o dos visitantes) só recebe se o visitante vê o tópico;
 * - quem clicou fica de fora: o próprio pedido já atualizou o botão, e a
 *   contagem não pode pular duas vezes.
 *
 * A contagem é lida na hora do envio, não na do clique: numa fila de verdade,
 * dois cliques seguidos entregam o número final, não o do meio. Com o
 * servidor do websocket fora do ar, lembra disso por 30 s (como o chat), para
 * cada clique não pagar as tentativas de conexão.
 */
final class MeTooPushJob extends AbstractJob
{
    public const EVENT = 'canelaMeToo';

    private const DOWN_KEY = 'canela.metoo.websocket_down';

    public function __construct(
        private readonly int $discussionId,
        private readonly int $actorId,
    ) {
        parent::__construct();
    }

    public function handle(Cache $cache, MeToo $meToo): void
    {
        if (! class_exists(\Pusher\Pusher::class) || ! class_exists(Audience::class) || $cache->get(self::DOWN_KEY)) {
            return;
        }

        try {
            /** @var Discussion|null $discussion */
            $discussion = Discussion::query()->find($this->discussionId);

            // Sem botão no tópico (tag fora da lista, solucionado, oculto…)
            // não há o que atualizar — nem o que contar a ninguém.
            if (! $discussion || ! $meToo->visibleOn($discussion)) {
                return;
            }

            /** @var Audience $audience */
            $audience = resolve(Audience::class);

            $connected = $audience->connectedUserIds();

            if ($connected === null) {
                $this->markDown($cache, 'sem resposta do servidor do websocket');

                return;
            }

            $public = $audience->canSeeDiscussion($discussion->id);
            $others = array_values(array_filter($connected, fn (int $id): bool => $id > 0 && $id !== $this->actorId));

            if (! $public && $others) {
                $others = User::query()->findMany($others)
                    ->filter(static fn (User $user): bool => $audience->canSeeDiscussion($discussion->id, $user))
                    ->map(static fn (User $user): int => (int) $user->id)
                    ->values()
                    ->all();
            }

            $channels = array_map(static fn (int $id): string => 'private-user='.$id, $others);

            if ($public) {
                $channels[] = 'public';
            }

            if (! $channels) {
                return;
            }

            $payload = [
                'discussionId' => (string) $discussion->id,
                'count' => $meToo->stateFor($discussion, new Guest())['count'],
            ];

            /** @var \Pusher\Pusher $pusher */
            $pusher = resolve(\Pusher\Pusher::class);

            // O Pusher aceita até 100 canais por envio.
            foreach (array_chunk($channels, 100) as $chunk) {
                $pusher->trigger($chunk, self::EVENT, $payload);
            }
        } catch (\Throwable $error) {
            // Só a falha de conexão silencia os próximos envios; um erro de
            // outro tipo fica no log e não atrapalha o clique seguinte.
            // Por nome: o pusher/pusher-php-server só existe com o flarum/realtime.
            $message = $error->getMessage();
            $connectionFailed = is_a($error, 'Pusher\PusherException') || $error instanceof \GuzzleHttp\Exception\TransferException;

            if ($connectionFailed) {
                $this->markDown($cache, $message);
            } else {
                Log::warning('me too: entrega em tempo real falhou: '.$message);
            }
        }
    }

    private function markDown(Cache $cache, string $reason): void
    {
        $cache->put(self::DOWN_KEY, true, 30);
        Log::warning('me too: websocket indisponível: '.$reason);
    }
}
