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

use Flarum\Http\SlugManager;
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

/**
 * Monta o JSON das respostas do chat: canais, mensagens, fios e os usuários
 * citados por eles.
 *
 * O chat tem a própria API (com cursor e contagens
 * por usuário), mas os usuários saem como objetos do JSON:API (`type: users`):
 * o fórum os põe no store e usa o Avatar, o nome e o link do perfil do core.
 *
 * Tudo o que uma lista de mensagens precisa (autores, reações, anexos,
 * respostas citadas, fios, fixadas) é carregado em lote — uma consulta por
 * tipo, nunca uma por mensagem.
 *
 * Uma instância por resposta: ela junta os usuários mencionados no caminho.
 */
final class ChatPresenter
{
    /** Quantos rostos o indicador do fio mostra. */
    private const THREAD_PARTICIPANTS = 3;

    /** @var array<int, true> */
    private array $userIds = [];

    /** @var array<int, User> */
    private array $loadedUsers = [];

    public function __construct(
        private readonly ChatAccess $access,
        private readonly UnreadCounter $counter,
        private readonly ChatUploads $uploads,
        private readonly SlugManager $slugs,
        private readonly ConnectionInterface $db,
    ) {
    }

    public function addUser(?int $id): void
    {
        if ($id) {
            $this->userIds[$id] = true;
        }
    }

    /** @param iterable<User> $users */
    public function addLoadedUsers(iterable $users): void
    {
        foreach ($users as $user) {
            $this->loadedUsers[$user->id] = $user;
            $this->userIds[$user->id] = true;
        }
    }

    /**
     * Os usuários juntados até aqui, como recursos `users` do JSON:API.
     *
     * @return list<array<string, mixed>>
     */
    public function users(): array
    {
        $missing = array_diff(array_keys($this->userIds), array_keys($this->loadedUsers));

        if ($missing) {
            foreach (User::query()->whereIn('id', $missing)->get() as $user) {
                $this->loadedUsers[$user->id] = $user;
            }
        }

        $out = [];

        foreach (array_keys($this->userIds) as $id) {
            if (isset($this->loadedUsers[$id])) {
                $out[] = $this->user($this->loadedUsers[$id]);
            }
        }

        return $out;
    }

    /** @return array<string, mixed> */
    public function user(User $user): array
    {
        return [
            'type' => 'users',
            'id' => (string) $user->id,
            'attributes' => [
                'username' => $user->username,
                'displayName' => $user->display_name,
                'avatarUrl' => $user->avatar_url,
                'slug' => $this->slugs->forResource(User::class)->toSlug($user),
            ],
        ];
    }

    // ─── Canais ─────────────────────────────────────────────────────────────

    /**
     * @param iterable<Channel> $channels
     * @return list<array<string, mixed>>
     */
    public function channels(iterable $channels, User $actor, bool $withCounts = true): array
    {
        $channels = Collection::make($channels);

        if ($channels->isEmpty()) {
            return [];
        }

        $ids = $channels->pluck('id')->all();

        /** @var Collection<int, Membership> $memberships */
        $memberships = Membership::query()->where('user_id', $actor->id)->whereIn('channel_id', $ids)->get()->keyBy('channel_id');
        $counts = $withCounts ? $this->counter->forUser($actor, $memberships->keys()->all()) : [];

        // Os participantes das MDs dão o título ("Ana, Bruno") e os avatares.
        $directIds = $channels->filter(static fn (Channel $c) => $c->isDirect())->pluck('id')->all();
        $participants = $directIds
            ? Membership::query()->whereIn('channel_id', $directIds)->orderBy('id')->get(['channel_id', 'user_id'])->groupBy('channel_id')
            : collect();

        $tags = $this->tags($channels->pluck('tag_id')->filter()->unique()->all());

        $lastMessages = Message::query()
            ->whereIn('id', $channels->pluck('last_message_id')->filter()->all())
            ->get(['id', 'user_id', 'cooked', 'created_at', 'deleted_at'])
            ->keyBy('id');

        return $channels->map(function (Channel $channel) use ($actor, $memberships, $counts, $participants, $tags, $lastMessages) {
            /** @var Membership|null $membership */
            $membership = $memberships->get($channel->id);
            $userIds = $participants->get($channel->id, collect())->pluck('user_id')->map(static fn ($id) => (int) $id)->all();

            foreach ($userIds as $id) {
                $this->addUser($id);
            }

            /** @var Message|null $last */
            $last = $channel->last_message_id ? $lastMessages->get($channel->last_message_id) : null;
            $this->addUser($last?->user_id);

            return $this->channel($channel, $actor, $membership, $counts[$channel->id] ?? null, $userIds, $channel->tag_id !== null ? ($tags[$channel->tag_id] ?? null) : null, $last);
        })->values()->all();
    }

    /**
     * @param int[] $participantIds
     * @param array{unread: int, mentions: int, threads: int, unseenPins: bool}|null $counts
     * @param array<string, mixed>|null $tag
     * @return array<string, mixed>
     */
    public function channel(Channel $channel, User $actor, ?Membership $membership, ?array $counts = null, array $participantIds = [], ?array $tag = null, ?Message $last = null): array
    {
        $canModerate = $this->access->canModerateChannel($channel, $actor);
        $cannotPost = $this->access->cannotPostReason($channel, $actor, $membership);

        return [
            'id' => $channel->id,
            'type' => $channel->type,
            'isGroup' => $channel->is_group,
            'name' => $channel->name,
            'slug' => $channel->slug ?: ($channel->isDirect() ? 'dm' : 'canal'),
            'description' => $channel->description,
            'emoji' => $channel->emoji,
            'tag' => $tag,
            'status' => $channel->statusName(),
            'threadingEnabled' => $this->access->threadsOn($channel),
            'allowChannelWideMentions' => $channel->allow_channel_wide_mentions,
            'autoJoin' => $channel->auto_join,
            'userCount' => $channel->user_count,
            'messagesCount' => $channel->messages_count,
            'lastMessageId' => $channel->last_message_id,
            'lastMessage' => $last && ! $last->isDeleted() ? [
                'id' => $last->id,
                'userId' => $last->user_id,
                'excerpt' => ChatFormatter::excerpt($last->cooked, 80),
                'createdAt' => $last->created_at?->toAtomString(),
            ] : null,
            'participantIds' => $participantIds,
            'createdAt' => $channel->created_at?->toAtomString(),
            'canModerate' => $canModerate,
            'canPost' => $cannotPost === null,
            'cannotPostReason' => $cannotPost,
            'canPin' => $this->access->canPin($channel, $actor, $membership),
            'canEdit' => $canModerate || ($channel->isDirect() && $channel->is_group && $membership !== null),
            'canAddMembers' => $canModerate || ($channel->isDirect() && $channel->is_group && $membership !== null),
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
     * @param iterable<Message> $messages
     * @return list<array<string, mixed>>
     */
    public function messages(iterable $messages, Channel $channel, User $actor): array
    {
        $messages = Collection::make($messages)->values();

        if ($messages->isEmpty()) {
            return [];
        }

        $ids = $messages->pluck('id')->all();

        $reactions = Reaction::query()->whereIn('message_id', $ids)->orderBy('id')->get()->groupBy('message_id');
        $uploads = Upload::query()->whereIn('message_id', $ids)->orderBy('id')->get()->groupBy('message_id');
        $pins = Pin::query()->whereIn('message_id', $ids)->get()->keyBy('message_id');

        $replyIds = $messages->pluck('in_reply_to_id')->filter()->unique()->all();
        $replies = $replyIds ? Message::query()->whereIn('id', $replyIds)->get(['id', 'user_id', 'cooked', 'deleted_at', 'thread_id'])->keyBy('id') : collect();

        $threadIds = $messages->pluck('thread_id')->filter()->unique()->all();
        $threads = $threadIds ? Thread::query()->whereIn('id', $threadIds)->get()->keyBy('id') : collect();
        $threadInfo = $this->threadPreviews($threads->all());

        return $messages->map(function (Message $message) use ($channel, $actor, $reactions, $uploads, $pins, $replies, $threads, $threadInfo) {
            /** @var Thread|null $thread */
            $thread = $message->thread_id ? $threads->get($message->thread_id) : null;
            $isOriginal = $thread !== null && $thread->original_message_id === $message->id;

            return $this->message(
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
        })->all();
    }

    /**
     * @param Collection<int, Reaction> $reactions
     * @param Collection<int, Upload> $uploads
     * @param array<string, mixed>|null $threadPreview
     * @return array<string, mixed>
     */
    public function message(
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
        $this->addUser($message->user_id);
        $this->addUser($message->deleted_by_id);
        $this->addUser($pin?->pinned_by_id);

        $grouped = [];

        foreach ($reactions as $reaction) {
            $grouped[$reaction->emoji] ??= ['emoji' => $reaction->emoji, 'count' => 0, 'userIds' => []];
            $grouped[$reaction->emoji]['count']++;

            // Os nomes da dica ("Ana, Bruno e Carla reagiram com…") precisam
            // dos primeiros; mais que isso só pesaria a resposta.
            if (count($grouped[$reaction->emoji]['userIds']) < 50) {
                $grouped[$reaction->emoji]['userIds'][] = $reaction->user_id;
                $this->addUser($reaction->user_id);
            }
        }

        if ($inReplyTo) {
            $this->addUser($inReplyTo->user_id);
        }

        $threadsOn = $this->access->threadsOn($channel);

        return [
            'id' => $message->id,
            'channelId' => $message->channel_id,
            'threadId' => $threadsOn && $thread ? $thread->id : null,
            'isThreadOriginal' => $threadsOn && $thread !== null && $thread->original_message_id === $message->id,
            'userId' => $message->user_id,
            'message' => $message->isDeleted() && ! $this->access->canSeeDeleted($message, $channel, $actor) ? '' : $message->message,
            'cooked' => $message->isDeleted() && ! $this->access->canSeeDeleted($message, $channel, $actor) ? '' : $message->cooked,
            'excerpt' => ChatFormatter::excerpt($message->cooked),
            'createdAt' => $message->created_at?->toAtomString(),
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
        ];
    }

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

            foreach ($people->take(self::THREAD_PARTICIPANTS) as $id) {
                $this->addUser($id);
            }

            $this->addUser($last?->user_id);

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
     * Um fio para a lista de fios e o cabeçalho do painel.
     *
     * @return array<string, mixed>
     */
    public function thread(Thread $thread, Channel $channel, User $actor, ?ThreadMembership $membership, int $unread = 0): array
    {
        $preview = $this->threadPreviews([$thread])[$thread->id] ?? [];

        /** @var Message|null $original */
        $original = Message::query()->find($thread->original_message_id);

        return [
            ...$preview,
            'channelId' => $thread->channel_id,
            'originalMessage' => $original ? ($this->messages([$original], $channel, $actor)[0] ?? null) : null,
            'membership' => $membership ? [
                'notificationLevel' => Thread::LEVEL_NAMES[$membership->notification_level] ?? 'tracking',
                'lastReadMessageId' => $membership->last_read_message_id,
                'unreadCount' => $unread,
            ] : null,
        ];
    }
}
