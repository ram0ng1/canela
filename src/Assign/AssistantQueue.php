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

namespace Ramon\Canela\Assign;

use Carbon\Carbon;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Queue\SyncQueue;

/**
 * Põe a resposta do assistente na fila, já com a espera escolhida no admin.
 *
 * Com uma fila de verdade (Redis, banco), o `later` cuida da espera. A fila
 * síncrona, a padrão do Flarum, ignora o atraso e responderia na hora: aí a
 * resposta fica em `canela_assistant_pending` e o agendador
 * (SendPendingReplies, a cada minuto) a publica quando chegar a hora.
 */
final class AssistantQueue
{
    public const TABLE = 'canela_assistant_pending';

    public function __construct(
        private readonly Queue $queue,
        private readonly AssistantBot $bot,
        private readonly ConnectionInterface $db,
    ) {
    }

    public function reply(int $discussionId, int $actorId, ?int $postId = null): void
    {
        $job = new AssistantReplyJob($discussionId, $actorId, $postId);
        $minutes = $this->bot->delay();

        if ($minutes === 0 && $this->queue instanceof SyncQueue) {
            // Na fila síncrona, no fim do pedido: no meio dele, o Flarum ainda
            // grava as tags do tópico novo depois do Started e desfaria a
            // troca de tags que o assistente decidiu.
            register_shutdown_function(fn () => $this->queue->push($job));
        } elseif ($minutes === 0) {
            $this->queue->push($job);
        } elseif (! $this->queue instanceof SyncQueue) {
            $this->queue->later(Carbon::now()->addMinutes($minutes), $job);
        } else {
            $this->db->table(self::TABLE)->insert([
                'discussion_id' => $discussionId,
                'actor_id' => $actorId,
                'post_id' => $postId,
                'due_at' => Carbon::now()->addMinutes($minutes),
            ]);
        }
    }

    /** Publica as que já passaram da hora; devolve quantas. */
    public function releaseDue(): int
    {
        $rows = $this->db->table(self::TABLE)->where('due_at', '<=', Carbon::now())->orderBy('id')->limit(50)->get();

        foreach ($rows as $row) {
            // Sai da tabela antes de rodar: um erro na IA não repete a resposta
            // a cada minuto.
            $this->db->table(self::TABLE)->where('id', $row->id)->delete();
            $this->queue->push(new AssistantReplyJob((int) $row->discussion_id, (int) $row->actor_id, $row->post_id !== null ? (int) $row->post_id : null));
        }

        return $rows->count();
    }
}
