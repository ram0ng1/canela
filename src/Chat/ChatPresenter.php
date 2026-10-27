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
use Illuminate\Support\Collection;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Pin;
use Ramon\Canela\Chat\Model\Reaction;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\ThreadMembership;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Chat\Upload\ChatUploads;
use Ramon\Canela\Support\Dates;

/**
 * Calcula os atributos dos recursos do chat que dependem do ator ou de outras
 * tabelas: as contagens de não lidas, a participação, as reações, os anexos,
 * a resposta citada, o resumo do fio, o que o ator pode fazer…
 *
 * Sempre em lote: recebe a lista inteira (as mensagens de uma página, os
 * canais da barra lateral) e faz uma consulta por tipo de dado, nunca uma por
 * item. Quem chama é o Api\ChatBatch, que junta os modelos de um documento
 * JSON:API antes de pedir os atributos de qualquer um deles.
 *
 * Cada item volta com `_userIds`: os usuários que os atributos citam (o autor,
 * quem reagiu, quem apagou, os participantes…). Eles saem como a relação
 * `users` do recurso, e o fórum os põe no store.
 */
final class ChatPresenter
{
    /** Quantos rostos o indicador do fio mostra. */
    private const THREAD_PARTICIPANTS = 3;

    public function __construct(
        private readonly ChatAccess $access,
        private readonly UnreadCounter $counter,
        private readonly ChatUploads $uploads,
        private readonly ConnectionInterface $db,
    ) {
    }

    // ─── Canais ─────────────────────────────────────────────────────────────

    /**
     * @param iterable<Channel> $channels
     * @return array<int, array<string, mixed>> por id do canal
     */
    public function channels(iterable $channels, User $actor): array
    {
        $channels = Collection::make($channels);

        if ($channels->isEmpty()) {
            return [];
        }

        $ids = $channels->pluck('id')->all();

        /** @var Collection<int, Membership> $memberships */
        $memberships = Membership::query()->where('user_id', $actor->id)->whereIn('channel_id', $ids)->get()->keyBy('channel_id');
        $this->access->primeMemberships($actor, $ids, $memberships);

        $counts = $this->counter->forUser($actor, $memberships->keys()->all());

        // Os participantes das MDs dão o título ("Ana, Bruno") e os avatares.
        $directIds = $channels->filter(static fn (Channel $c) => $c->isDirect())->pluck('id')->all();
        $participants = $directIds
            ? Membership::query()->whereIn('channel_id', $directIds)->orderBy('id')->get(['channel_id', 'user_id'])->groupBy('channel_id')
            : collect();

        $tags = $this->tags($channels->pluck('tag_id')->filter()->unique()->all());

        $lastIds = $channels->pluck('last_message_id')->filter()->all();
        $lastMessages = $lastIds
            ? Message::query()->whereIn('id', $lastIds)->get(['id', 'user_id', 'cooked', 'created_at', 'deleted_at'])->keyBy('id')
            : collect();

        $out = [];

        foreach ($channels as $channel) {
            /** @var Membership|null $membership */
            $membership = $memberships->get($channel->id);
            $userIds = $participants->get($channel->id, collect())->pluck('user_id')->map(static fn ($id) => (int) $id)->all();

            /** @var Message|null $last */
            $last = $channel->last_message_id ? $lastMessages->get($channel->last_message_id) : null;

            $data = $this->channel($channel, $actor, $membership, $counts[$channel->id] ?? null, $userIds, $channel->tag_id !== null ? ($tags[$channel->tag_id] ?? null) : null, $last);
            $data['_userIds'] = self::ids([...$userIds, $last && ! $last->isDeleted() ? $last->user_id : null]);

            $out[$channel->id] = $data;
        }

        return $out;
    }

    /**
     * @param int[] $participantIds
     * @param array{unread: int, mentions: int, threads: int, unseenPins: bool}|null $counts
     * @param array<string, mixed>|null $tag
     * @return array<string, mixed>
     */
    private function channel(Channel $channel, User $actor, ?Membership $membership, ?array $counts, array $participantIds, ?array $tag, ?Message $last): array
    {
        $cannotPost = $this->access->cannotPostReason($channel, $actor, $membership);

        return [
            'type' => $channel->type,
            'isGroup' => $channel->is_group,
            'slug' => $channel->slug ?: ($channel->isDirect() ? 'dm' : 'canal'),
            'tag' => $tag,
            'status' => $channel->statusName(),
            'threadingEnabled' => $this->access->threadsOn($channel),
            'lastMessage' => $last && ! $last->isDeleted() ? [
                'id' => $last->id,
                'userId' => $last->user_id,
                'excerpt' => ChatFormatter::excerpt($last->cooked, 80),
                'createdAt' => Dates::atom($last->created_at),
            ] : null,
            'participantIds' => $participantIds,
            'canModerate' => $actor->can('moderate', $channel),
            'canPost' => $cannotPost === null,
            'cannotPostReason' => $cannotPost,
            'canPin' => $actor->can('pin', $channel),
            'canEdit' => $actor->can('edit', $channel),
            'canAddMembers' => $actor->can('addMembers', $channel),
            'canDelete' => $actor->can('delete', $channel),
            'membership' => $membership ? [
                'following' => $membership->following,
                'muted' => $membership->muted,
                'notificationLevel' => $membership->levelName(),
                'starred' => $membership->starred,
                'lastReadMessageId' => $membership->last_read_message_id,
                'lastViewedAt' => $membership->last_viewed_at?->toAtomString(),
                'unreadCount' => $counts['unread'] ?? 0,
                'mentionCount' => $counts['mentions'] ?? 0,
                'unreadThreadsCount' => $counts['threads'] ?? 0,
                'hasUnseenPins' => $counts['unseenPins'] ?? false,
            ] : null,
        ];
    }

    /**
     * Nome, cor e ícone das tags dos canais (a "categoria").
     *
     * @param int[] $ids
     * @return array<int, array<string, mixed>>
     */
    public function tags(array $ids): array
    {
        if (! $ids || ! $this->access->tagsEnabled()) {
            return [];
        }

        return \Flarum\Tags\Tag::query()->whereIn('id', $ids)->get()->mapWithKeys(static fn ($tag) => [(int) $tag->id => [
            'id' => (int) $tag->id,
            'name' => $tag->name,
            'slug' => $tag->slug,
            'color' => $tag->color,
            'icon' => $tag->icon,
        ]])->all();
    }

    // ─── Mensagens ──────────────────────────────────────────────────────────

    /**
     * As mensagens, de um canal ou de vários (a busca): tudo numa consulta por
     * tipo de dado, qualquer que seja o número de canais.
     *
     * @param iterable<Message> $messages
     * @param array<int, Channel> $channels os canais das mensagens, por id
     * @return array<int, array<string, mixed>> por id da mensagem
     */
    public function messages(iterable $messages, array $channels, User $actor): array
    {
        $messages = Collection::make($messages)->filter(static fn (Message $m) => isset($channels[$m->channel_id]))->values();

        if ($messages->isEmpty()) {
            return [];
        }

        $this->access->primeMemberships($actor, $messages->pluck('channel_id')->unique()->values()->all());

        $ids = $messages->pluck('id')->all();

        $reactions = Reaction::query()->whereIn('message_id', $ids)->orderBy('id')->get()->groupBy('message_id');
        $uploads = Upload::query()->whereIn('message_id', $ids)->orderBy('id')->get()->groupBy('message_id');
        $pins = Pin::query()->whereIn('message_id', $ids)->get()->keyBy('message_id');

        $replyIds = $messages->pluck('in_reply_to_id')->filter()->unique()->all();
        $replies = $replyIds ? Message::query()->whereIn('id', $replyIds)->get(['id', 'user_id', 'cooked', 'deleted_at', 'thread_id'])->keyBy('id') : collect();

        $threadIds = $messages->pluck('thread_id')->filter()->unique()->all();
        $threads = $threadIds ? Thread::query()->whereIn('id', $threadIds)->get()->keyBy('id') : collect();
        $threadInfo = $this->threadPreviews($threads->all());

        $out = [];

        foreach ($messages as $message) {
            $channel = $channels[$message->channel_id];

            // As policies leem o canal pela relação: sem isto, uma consulta por mensagem.
            $message->setRelation('channel', $channel);

            /** @var Thread|null $thread */
            $thread = $message->thread_id ? $threads->get($message->thread_id) : null;
            $isOriginal = $thread !== null && $thread->original_message_id === $message->id;

            $out[$message->id] = $this->message(
                $message,
                $channel,
                $actor,
                $reactions->get($message->id, collect()),
                $uploads->get($message->id, collect()),
                $pins->get($message->id),
                $message->in_reply_to_id ? $replies->get($message->in_reply_to_id) : null,
                $thread,
                $isOriginal ? ($threadInfo[$thread->id] ?? null) : null,
            );
        }

        return $out;
    }

    /**
     * @param Collection<int, Reaction> $reactions
     * @param Collection<int, Upload> $uploads
     * @param array<string, mixed>|null $threadPreview
     * @return array<string, mixed>
     */
    private function message(
        Message $message,
        Channel $channel,
        User $actor,
        Collection $reactions,
        Collection $uploads,
        ?Pin $pin,
        ?Message $inReplyTo,
        ?Thread $thread,
        ?array $threadPreview,
    ): array {
        $userIds = [$message->user_id, $message->deleted_by_id, $pin?->pinned_by_id];

        $grouped = [];

        foreach ($reactions as $reaction) {
            $grouped[$reaction->emoji] ??= ['emoji' => $reaction->emoji, 'count' => 0, 'userIds' => []];
            $grouped[$reaction->emoji]['count']++;

            // Os nomes da dica ("Ana, Bruno e Carla reagiram com…") precisam
            // dos primeiros; mais que isso só pesaria a resposta.
            if (count($grouped[$reaction->emoji]['userIds']) < 50) {
                $grouped[$reaction->emoji]['userIds'][] = $reaction->user_id;
                $userIds[] = $reaction->user_id;
            }
        }

        if ($inReplyTo) {
            $userIds[] = $inReplyTo->user_id;
        }

        if ($threadPreview) {
            array_push($userIds, $threadPreview['lastReplyUserId'], ...$threadPreview['participantIds']);
        }

        $threadsOn = $this->access->threadsOn($channel);
        // Apagada e sem direito de ver: some o texto e o trecho também.
        $hidden = $message->isDeleted() && ! $this->access->canSeeDeleted($message, $channel, $actor);

        return [
            'channelId' => $message->channel_id,
            'threadId' => $threadsOn && $thread ? $thread->id : null,
            'isThreadOriginal' => $threadsOn && $thread !== null && $thread->original_message_id === $message->id,
            'userId' => $message->user_id,
            'message' => $hidden ? '' : $message->message,
            'cooked' => $hidden ? '' : $message->cooked,
            'excerpt' => $hidden ? '' : ChatFormatter::excerpt($message->cooked),
            'createdAt' => Dates::atom($message->created_at),
            'editedAt' => $message->edited_at?->toAtomString(),
            'deletedAt' => $message->deleted_at?->toAtomString(),
            'deletedById' => $message->deleted_by_id,
            'inReplyTo' => $inReplyTo ? [
                'id' => $inReplyTo->id,
                'userId' => $inReplyTo->user_id,
                'excerpt' => $inReplyTo->isDeleted() ? '' : ChatFormatter::excerpt($inReplyTo->cooked, 100),
                'deleted' => $inReplyTo->isDeleted(),
            ] : null,
            'reactions' => array_values($grouped),
            'uploads' => $uploads->map(fn (Upload $upload) => $this->uploads->present($upload))->values()->all(),
            'pinned' => $pin !== null,
            'pinnedById' => $pin?->pinned_by_id,
            'pinnedAt' => $pin?->created_at?->toAtomString(),
            'thread' => $threadPreview,
            'canEdit' => $actor->can('edit', $message),
            'canDelete' => $actor->can('delete', $message),
            'canRestore' => $actor->can('restore', $message),
            '_userIds' => self::ids($userIds),
        ];
    }

    // ─── Fios ───────────────────────────────────────────────────────────────

    /**
     * O resumo de cada fio para o indicador debaixo da original: respostas,
     * a última (quem, quando, o começo) e os participantes mais recentes.
     *
     * @param Thread[] $threads
     * @return array<int, array<string, mixed>>
     */
    public function threadPreviews(array $threads): array
    {
        if (! $threads) {
            return [];
        }

        $threadIds = array_map(static fn (Thread $t) => $t->id, $threads);
        $lastIds = array_filter(array_map(static fn (Thread $t) => $t->last_message_id, $threads));
        $lasts = $lastIds ? Message::query()->whereIn('id', $lastIds)->get(['id', 'user_id', 'cooked', 'created_at', 'deleted_at'])->keyBy('id') : collect();

        // Quem respondeu em cada fio, do mais recente para o mais antigo.
        $participants = $this->db->table('canela_chat_messages')
            ->whereIn('thread_id', $threadIds)
            ->whereNull('deleted_at')
            ->whereNotNull('user_id')
            ->groupBy('thread_id', 'user_id')
            ->selectRaw('max(id) as last_id')
            ->addSelect('thread_id', 'user_id')
            ->get()
            ->groupBy('thread_id');

        $out = [];

        foreach ($threads as $thread) {
            /** @var Message|null $last */
            $last = $thread->last_message_id && $thread->last_message_id !== $thread->original_message_id ? $lasts->get($thread->last_message_id) : null;
            $people = Collection::make($participants->get($thread->id, []))->sortByDesc('last_id')->pluck('user_id')->map(static fn ($id) => (int) $id)->values();

            $out[$thread->id] = [
                'id' => $thread->id,
                'title' => $thread->title,
                'replyCount' => $thread->replies_count,
                'lastReplyId' => $last?->id,
                'lastReplyUserId' => $last?->user_id,
                'lastReplyExcerpt' => $last && ! $last->isDeleted() ? ChatFormatter::excerpt($last->cooked, 100) : '',
                'lastReplyCreatedAt' => $last?->created_at?->toAtomString(),
                'participantIds' => $people->take(self::THREAD_PARTICIPANTS)->all(),
                'participantCount' => $people->count(),
            ];
        }

        return $out;
    }

    /**
     * Os fios para a lista de fios e o cabeçalho do painel: o resumo, o
     * acompanhamento do ator e as não lidas dele.
     *
     * @param iterable<Thread> $threads
     * @return array<int, array<string, mixed>> por id do fio
     */
    public function threads(iterable $threads, User $actor): array
    {
        $threads = Collection::make($threads)->values();

        if ($threads->isEmpty()) {
            return [];
        }

        $previews = $this->threadPreviews($threads->all());
        $memberships = ThreadMembership::query()->where('user_id', $actor->id)->whereIn('thread_id', $threads->pluck('id')->all())->get()->keyBy('thread_id');
        $unread = $this->counter->threadUnread($actor, $memberships->keys()->all());

        $out = [];

        foreach ($threads as $thread) {
            $preview = $previews[$thread->id];
            /** @var ThreadMembership|null $membership */
            $membership = $memberships->get($thread->id);

            $out[$thread->id] = [
                ...$preview,
                'channelId' => $thread->channel_id,
                'canRename' => $actor->can('rename', $thread),
                'membership' => $membership ? [
                    'notificationLevel' => Thread::LEVEL_NAMES[$membership->notification_level] ?? 'tracking',
                    'lastReadMessageId' => $membership->last_read_message_id,
                    'unreadCount' => $unread[$thread->id] ?? 0,
                ] : null,
                '_userIds' => self::ids([$preview['lastReplyUserId'], ...$preview['participantIds']]),
            ];
        }

        return $out;
    }

    /**
     * @param array<int|null> $ids
     * @return int[]
     */
    private static function ids(array $ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id) => $id > 0)));
    }
}
