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

namespace Ramon\Canela\Chat;

use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * As contagens do "tracking state" do Discourse para um usuário: não lidas,
 * menções não lidas e fios não lidos de cada canal — três consultas agrupadas,
 * para todos os canais de uma vez, em vez de três por canal.
 *
 * "Não lida" é toda mensagem depois da última lida, de outra pessoa, que não
 * esteja apagada e que apareça na conversa principal: com os fios ligados, as
 * respostas de um fio contam no fio, não no canal.
 */
final class UnreadCounter
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ChatSettings $settings,
    ) {
    }

    /**
     * @param int[] $channelIds
     * @return array<int, array{unread: int, mentions: int, threads: int, unseenPins: bool}>
     */
    public function forUser(User $actor, array $channelIds): array
    {
        $result = [];

        foreach ($channelIds as $id) {
            $result[$id] = ['unread' => 0, 'mentions' => 0, 'threads' => 0, 'unseenPins' => false];
        }

        if (! $channelIds || $actor->isGuest()) {
            return $result;
        }

        $actorId = (int) $actor->id;
        $threadsGlobal = $this->settings->bool(ChatSettings::THREADS_ENABLED);

        $unread = $this->db->table('canela_chat_messages as m')
            ->join('canela_chat_memberships as mb', function ($join) use ($actorId) {
                $join->on('mb.channel_id', '=', 'm.channel_id')->where('mb.user_id', '=', $actorId);
            })
            ->join('canela_chat_channels as c', 'c.id', '=', 'm.channel_id')
            ->leftJoin('canela_chat_threads as t', 't.id', '=', 'm.thread_id')
            ->whereIn('m.channel_id', $channelIds)
            ->whereNull('m.deleted_at')
            ->where(fn (Builder $q) => $q->whereNull('m.user_id')->orWhere('m.user_id', '<>', $actorId))
            ->where(fn (Builder $q) => $q->whereNull('mb.last_read_message_id')->orWhereColumn('m.id', '>', 'mb.last_read_message_id'))
            ->where(fn (Builder $q) => $this->mainStream($q, $threadsGlobal))
            ->groupBy('m.channel_id')
            ->selectRaw('count(*) as aggregate')
            ->addSelect('m.channel_id')
            ->get();

        foreach ($unread as $row) {
            $result[(int) $row->channel_id]['unread'] = (int) $row->aggregate;
        }

        $mentions = $this->db->table('canela_chat_mentions as mn')
            ->join('canela_chat_messages as m', 'm.id', '=', 'mn.message_id')
            ->join('canela_chat_memberships as mb', function ($join) use ($actorId) {
                $join->on('mb.channel_id', '=', 'm.channel_id')->where('mb.user_id', '=', $actorId);
            })
            ->join('canela_chat_channels as c', 'c.id', '=', 'm.channel_id')
            ->leftJoin('canela_chat_threads as t', 't.id', '=', 'm.thread_id')
            ->leftJoin('canela_chat_thread_memberships as tm', function ($join) use ($actorId) {
                $join->on('tm.thread_id', '=', 'm.thread_id')->where('tm.user_id', '=', $actorId);
            })
            ->where('mn.user_id', $actorId)
            ->whereIn('m.channel_id', $channelIds)
            ->whereNull('m.deleted_at')
            ->where(function (Builder $q) use ($threadsGlobal) {
                // Na conversa principal, contra a última lida do canal; dentro
                // de um fio, contra a última lida do fio.
                $q->where(function (Builder $main) use ($threadsGlobal) {
                    $main->where(fn (Builder $s) => $this->mainStream($s, $threadsGlobal))
                        ->where(fn (Builder $s) => $s->whereNull('mb.last_read_message_id')->orWhereColumn('m.id', '>', 'mb.last_read_message_id'));
                })->orWhere(function (Builder $thread) use ($threadsGlobal) {
                    $thread->whereNot(fn (Builder $s) => $this->mainStream($s, $threadsGlobal))
                        ->where(fn (Builder $s) => $s->whereNull('tm.last_read_message_id')->orWhereColumn('m.id', '>', 'tm.last_read_message_id'));
                });
            })
            ->groupBy('m.channel_id')
            ->selectRaw('count(*) as aggregate')
            ->addSelect('m.channel_id')
            ->get();

        foreach ($mentions as $row) {
            $result[(int) $row->channel_id]['mentions'] = (int) $row->aggregate;
        }

        if ($threadsGlobal) {
            $threads = $this->db->table('canela_chat_threads as t')
                ->join('canela_chat_thread_memberships as tm', function ($join) use ($actorId) {
                    $join->on('tm.thread_id', '=', 't.id')->where('tm.user_id', '=', $actorId);
                })
                ->join('canela_chat_channels as c', 'c.id', '=', 't.channel_id')
                ->where('c.threading_enabled', true)
                ->whereIn('t.channel_id', $channelIds)
                ->where('tm.notification_level', '>=', 2)
                ->where('t.replies_count', '>', 0)
                ->where(fn (Builder $q) => $q->whereNull('tm.last_read_message_id')->orWhereColumn('t.last_message_id', '>', 'tm.last_read_message_id'))
                ->groupBy('t.channel_id')
                ->selectRaw('count(*) as aggregate')
                ->addSelect('t.channel_id')
                ->get();

            foreach ($threads as $row) {
                $result[(int) $row->channel_id]['threads'] = (int) $row->aggregate;
            }
        }

        // "Fixadas novas": alguém (que não o próprio usuário) fixou algo depois
        // da última vez que ele abriu a lista de fixadas.
        $pins = $this->db->table('canela_chat_pins as p')
            ->join('canela_chat_memberships as mb', function ($join) use ($actorId) {
                $join->on('mb.channel_id', '=', 'p.channel_id')->where('mb.user_id', '=', $actorId);
            })
            ->whereIn('p.channel_id', $channelIds)
            ->where(fn (Builder $q) => $q->whereNull('p.pinned_by_id')->orWhere('p.pinned_by_id', '<>', $actorId))
            ->where(fn (Builder $q) => $q->whereNull('mb.last_viewed_pins_at')->orWhereColumn('p.created_at', '>', 'mb.last_viewed_pins_at'))
            ->distinct()
            ->pluck('p.channel_id');

        foreach ($pins as $channelId) {
            $result[(int) $channelId]['unseenPins'] = true;
        }

        return $result;
    }

    /**
     * Respostas não lidas de cada fio, para a lista de fios.
     *
     * @param int[] $threadIds
     * @return array<int, int>
     */
    public function threadUnread(User $actor, array $threadIds): array
    {
        if (! $threadIds) {
            return [];
        }

        $actorId = (int) $actor->id;

        return $this->db->table('canela_chat_messages as m')
            ->join('canela_chat_threads as t', 't.id', '=', 'm.thread_id')
            ->join('canela_chat_thread_memberships as tm', function ($join) use ($actorId) {
                $join->on('tm.thread_id', '=', 'm.thread_id')->where('tm.user_id', '=', $actorId);
            })
            ->whereIn('m.thread_id', $threadIds)
            ->whereColumn('m.id', '<>', 't.original_message_id')
            ->whereNull('m.deleted_at')
            ->where(fn (Builder $q) => $q->whereNull('m.user_id')->orWhere('m.user_id', '<>', $actorId))
            ->where(fn (Builder $q) => $q->whereNull('tm.last_read_message_id')->orWhereColumn('m.id', '>', 'tm.last_read_message_id'))
            ->groupBy('m.thread_id')
            ->selectRaw('count(*) as aggregate')
            ->addSelect('m.thread_id')
            ->get()
            ->mapWithKeys(static fn ($row) => [(int) $row->thread_id => (int) $row->aggregate])
            ->all();
    }

    /**
     * A mensagem aparece na conversa principal: não é resposta de um fio, ou é a
     * original dele, ou os fios estão desligados (aí tudo volta ao canal, como
     * no Discourse quando se desliga o recurso).
     */
    private function mainStream(Builder $query, bool $threadsGlobal): void
    {
        if (! $threadsGlobal) {
            $query->whereRaw('1 = 1');

            return;
        }

        $query->whereNull('m.thread_id')
            ->orWhereNull('t.id')
            ->orWhereColumn('t.original_message_id', 'm.id')
            ->orWhere('c.threading_enabled', false);
    }
}
