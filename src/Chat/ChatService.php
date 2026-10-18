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

use Carbon\Carbon;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Pin;
use Ramon\Canela\Chat\Model\Reaction;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\ThreadMembership;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Chat\Realtime\ChatBroadcaster;
use Ramon\Canela\Chat\Upload\ChatUploads;

/**
 * As ações do chat — os "services" do Discourse (CreateMessage, UpdateMessage,
 * TrashMessage, CreateDirectMessageChannel…) num lugar só.
 *
 * Cada ação confere a permissão, grava numa transação e só depois avisa: as
 * notificações e o websocket nunca anunciam algo que acabou não sendo salvo.
 */
final class ChatService
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ChatFormatter $formatter,
        private readonly ChatNotifier $notifier,
        private readonly ChatBroadcaster $broadcaster,
        private readonly ChatUploads $uploads,
        private readonly ConnectionInterface $db,
        private readonly TranslatorInterface $translator,
    ) {
    }

    private function fail(string $field, string $key, array $params = []): never
    {
        throw new ValidationException([$field => $this->translator->trans('ramon-canela.forum.chat.errors.'.$key, $params)]);
    }

    // ─── Participação ───────────────────────────────────────────────────────

    /**
     * Entra no canal (ou volta a ele). Quem entra começa com tudo lido, como no
     * Discourse: o histórico inteiro não vira "não lido" de uma vez.
     */
    public function follow(Channel $channel, User $actor): Membership
    {
        $this->access->assertCanUse($actor);

        if ($channel->isDirect() && ! $this->access->membership($channel, $actor)) {
            throw new ModelNotFoundException();
        }

        $membership = $this->access->membership($channel, $actor) ?? new Membership();
        $wasFollowing = $membership->exists && $membership->following;

        $membership->channel_id = $channel->id;
        $membership->user_id = (int) $actor->id;
        $membership->following = true;

        if (! $wasFollowing) {
            $membership->last_read_message_id = $channel->last_message_id;
            $membership->notification_level = $membership->exists ? $membership->notification_level : ($channel->isDirect() ? Membership::NOTIFY_ALWAYS : Membership::NOTIFY_MENTION);
        }

        $membership->save();
        $this->refreshUserCount($channel);

        return $membership;
    }

    /**
     * Sai do canal. Num canal público só deixa de seguir (a linha guarda até
     * onde leu); numa MD 1:1 a conversa só sai da lista; num grupo a pessoa
     * deixa de participar e só volta se for adicionada de novo.
     */
    public function leave(Channel $channel, User $actor): void
    {
        $membership = $this->access->membership($channel, $actor);

        if (! $membership) {
            return;
        }

        if ($channel->isDirect() && $channel->is_group) {
            $membership->delete();

            $remaining = Membership::query()->where('channel_id', $channel->id)->pluck('user_id')->all();
            $channel->direct_key = $remaining ? 'g'.$channel->id.':'.Channel::directKey($remaining) : null;
            $channel->save();
        } else {
            $membership->following = false;
            $membership->save();
        }

        $this->refreshUserCount($channel);
        $this->broadcaster->send([(int) $actor->id], ['type' => 'membership', 'channelId' => $channel->id]);
    }

    /** @param array<string, mixed> $attributes */
    public function updateMembership(Channel $channel, User $actor, array $attributes): Membership
    {
        $membership = $this->access->membership($channel, $actor);

        if (! $membership) {
            $membership = $this->follow($channel, $actor);
        }

        if (array_key_exists('muted', $attributes)) {
            $membership->muted = (bool) $attributes['muted'];
        }

        if (array_key_exists('starred', $attributes)) {
            $membership->starred = (bool) $attributes['starred'];
        }

        if (isset($attributes['notificationLevel'])) {
            $level = array_search((string) $attributes['notificationLevel'], Membership::LEVEL_NAMES, true);

            if ($level !== false) {
                $membership->notification_level = (int) $level;
            }
        }

        $membership->save();

        return $membership;
    }

    public function refreshUserCount(Channel $channel): void
    {
        $channel->user_count = Membership::query()->where('channel_id', $channel->id)->where('following', true)->count();
        $channel->save();
    }

    /**
     * Marca o canal lido até a mensagem (ou até a última). Nunca volta atrás:
     * duas abas abertas não "desleem" uma à outra.
     */
    public function markRead(Channel $channel, User $actor, ?int $messageId): ?Membership
    {
        $membership = $this->access->membership($channel, $actor);

        if (! $membership) {
            return null;
        }

        $target = $messageId && $channel->last_message_id ? min($messageId, $channel->last_message_id) : $channel->last_message_id;

        if ($target && $target > (int) $membership->last_read_message_id) {
            $membership->last_read_message_id = $target;
        }

        $membership->last_viewed_at = Carbon::now();
        $membership->save();

        $this->notifier->markChannelRead($channel, $actor);

        // As outras abas da mesma pessoa atualizam o contador.
        $this->broadcaster->send([(int) $actor->id], [
            'type' => 'read',
            'channelId' => $channel->id,
            'lastReadMessageId' => $membership->last_read_message_id,
        ]);

        return $membership;
    }

    public function markThreadRead(Thread $thread, User $actor, ?int $messageId): ThreadMembership
    {
        $membership = $this->threadMembership($thread, $actor, Thread::LEVEL_TRACKING);
        $target = $messageId && $thread->last_message_id ? min($messageId, $thread->last_message_id) : $thread->last_message_id;

        if ($target && $target > (int) $membership->last_read_message_id) {
            $membership->last_read_message_id = $target;
            $membership->save();
        }

        $this->broadcaster->send([(int) $actor->id], ['type' => 'read', 'channelId' => $thread->channel_id, 'threadId' => $thread->id]);

        return $membership;
    }

    public function threadMembership(Thread $thread, User $actor, int $level): ThreadMembership
    {
        /** @var ThreadMembership|null $membership */
        $membership = ThreadMembership::query()->where('thread_id', $thread->id)->where('user_id', $actor->id)->first();

        if (! $membership) {
            $membership = new ThreadMembership();
            $membership->thread_id = $thread->id;
            $membership->user_id = (int) $actor->id;
            $membership->notification_level = $level;
            $membership->last_read_message_id = $thread->last_message_id;
            $membership->save();
        }

        return $membership;
    }

    /**
     * Os canais com "Adicionar usuários automaticamente" que o ator enxerga e
     * nos quais nunca entrou. O Discourse faz isso de hora em hora para quem
     * esteve ativo; aqui acontece quando a pessoa abre o fórum — sem agendador
     * e sem varrer todos os usuários de uma vez.
     */
    public function autoJoin(User $actor): void
    {
        if (! $this->access->canUse($actor)) {
            return;
        }

        $query = Channel::query()
            ->where('type', Channel::TYPE_PUBLIC)
            ->where('auto_join', true)
            ->where('status', '<>', Channel::STATUS_ARCHIVED);

        // Em instrução separada: o que o Eloquent repassa ao query builder
        // altera a mesma consulta, e `$query` segue um Builder de Channel.
        $query->whereNotExists(static function ($exists) use ($actor) {
            $exists->selectRaw('1')
                ->from('canela_chat_memberships')
                ->whereColumn('canela_chat_memberships.channel_id', 'canela_chat_channels.id')
                ->where('canela_chat_memberships.user_id', $actor->id);
        })
            ->limit(20);

        $this->access->scopeVisibleChannels($query, $actor);

        foreach ($query->get() as $channel) {
            $this->follow($channel, $actor);
        }
    }

    // ─── Mensagens ──────────────────────────────────────────────────────────

    private function validateText(string $text, bool $hasUploads): string
    {
        // Só espaços à direita saem: a indentação de um bloco de código importa.
        $text = rtrim(str_replace(["\r\n", "\r"], "\n", $text));
        $max = $this->access->settings()->maxMessageLength();

        if (trim($text) === '' && ! $hasUploads) {
            $this->fail('message', 'message_empty');
        }

        if (mb_strlen($text) > $max) {
            $this->fail('message', 'message_too_long', ['count' => $max]);
        }

        return $text;
    }

    /**
     * Os anexos enviados pelo próprio ator que ainda não estão em outra mensagem.
     *
     * @param int[] $ids
     * @return \Illuminate\Database\Eloquent\Collection<int, Upload>
     */
    private function ownUploads(User $actor, array $ids, ?Message $message = null)
    {
        $ids = array_slice(array_values(array_unique(array_map('intval', $ids))), 0, Upload::MAX_PER_MESSAGE);

        return Upload::query()
            ->whereIn('id', $ids ?: [0])
            ->where('user_id', $actor->id)
            ->where(static fn ($q) => $q->whereNull('message_id')->when($message, static fn ($q) => $q->orWhere('message_id', $message->id)))
            ->get();
    }

    /**
     * Envia uma mensagem. Responder a uma mensagem num canal com fios ligados
     * abre (ou continua) o fio dela, como no Discourse.
     *
     * @param int[] $uploadIds
     */
    public function createMessage(Channel $channel, User $actor, string $text, ?int $inReplyToId, ?int $threadId, array $uploadIds = []): Message
    {
        $membership = $this->access->membership($channel, $actor);
        $this->access->assertCanPost($channel, $actor, $membership);

        // Um teto de rajada, como os limites do Discourse: 10 mensagens em 10
        // segundos já é mais rápido do que alguém digita. A moderação não tem.
        if (! $this->access->canModerate($actor) && Message::query()->where('user_id', $actor->id)->where('created_at', '>', Carbon::now()->subSeconds(10))->count() >= 10) {
            $this->fail('message', 'too_fast');
        }

        $uploads = $this->access->settings()->bool(ChatSettings::UPLOADS_ENABLED) ? $this->ownUploads($actor, $uploadIds) : collect();
        $text = $this->validateText($text, $uploads->isNotEmpty());

        $inReplyTo = null;

        if ($inReplyToId) {
            /** @var Message|null $inReplyTo */
            $inReplyTo = Message::query()->where('channel_id', $channel->id)->whereNull('deleted_at')->find($inReplyToId);

            if (! $inReplyTo) {
                $this->fail('inReplyToId', 'reply_not_found');
            }
        }

        $thread = null;

        if ($threadId) {
            /** @var Thread|null $thread */
            $thread = Thread::query()->where('channel_id', $channel->id)->find($threadId);

            if (! $thread || ! $this->access->threadsOn($channel)) {
                $this->fail('threadId', 'thread_not_found');
            }
        }

        $message = new Message();
        $cooked = null;

        $this->db->transaction(function () use ($channel, $actor, $text, $inReplyTo, &$thread, $uploads, $membership, $message, &$cooked) {
            // Responder fora do painel do fio, com os fios ligados, leva a
            // conversa para o fio da mensagem respondida.
            if (! $thread && $inReplyTo && $this->access->threadsOn($channel)) {
                $thread = $inReplyTo->thread_id ? Thread::query()->find($inReplyTo->thread_id) : null;
                $thread ??= $this->createThread($channel, $inReplyTo);
            }

            $message->channel_id = $channel->id;
            $message->user_id = (int) $actor->id;
            $message->thread_id = $thread?->id;
            $message->in_reply_to_id = $inReplyTo?->id;
            $message->message = $text;
            $message->cooked = '';
            $message->save();

            $cooked = $this->formatter->cook($text, $message, $actor);
            $message->cooked = $cooked['cooked'];
            $message->save();

            if ($uploads->isNotEmpty()) {
                Upload::query()->whereIn('id', $uploads->pluck('id')->all())->update(['message_id' => $message->id]);
            }

            if ($thread) {
                $thread->last_message_id = $message->id;
                $thread->replies_count = Message::query()->where('thread_id', $thread->id)->where('id', '<>', $thread->original_message_id)->whereNull('deleted_at')->count();
                $thread->save();

                $own = $this->threadMembership($thread, $actor, Thread::LEVEL_TRACKING);
                $own->last_read_message_id = $message->id;
                $own->save();
            }

            $channel->last_message_id = $message->id;
            $channel->messages_count = $channel->messages_count + 1;
            $channel->save();

            // Escrever numa MD que a pessoa tinha fechado a traz de volta, e a
            // própria mensagem nunca conta como não lida.
            $membership ??= $this->follow($channel, $actor);
            $membership->following = true;

            if (! $thread || $thread->original_message_id === $message->id) {
                $membership->last_read_message_id = $message->id;
            }

            $membership->last_viewed_at = Carbon::now();
            $membership->save();

            // Numa MD, quem tinha fechado a conversa a vê de novo com a mensagem.
            if ($channel->isDirect()) {
                Membership::query()->where('channel_id', $channel->id)->where('following', false)->update(['following' => true]);
            }
        });

        $this->afterWrite($message, $channel, $actor, true, $cooked);

        return $message;
    }

    private function createThread(Channel $channel, Message $original): Thread
    {
        $thread = new Thread();
        $thread->channel_id = $channel->id;
        $thread->original_message_id = $original->id;
        $thread->original_message_user_id = $original->user_id;
        $thread->last_message_id = $original->id;
        $thread->replies_count = 0;
        $thread->save();

        $original->thread_id = $thread->id;
        $original->save();

        // O autor da original passa a acompanhar o fio que nasceu dela.
        if ($original->user_id) {
            $author = User::query()->find($original->user_id);

            if ($author) {
                $this->threadMembership($thread, $author, Thread::LEVEL_TRACKING);
            }
        }

        return $thread;
    }

    /** @param int[]|null $uploadIds null mantém os anexos como estão */
    public function updateMessage(Message $message, Channel $channel, User $actor, string $text, ?array $uploadIds): Message
    {
        $membership = $this->access->membership($channel, $actor);

        if (! $this->access->canEditMessage($message, $channel, $actor, $membership)) {
            throw new PermissionDeniedException();
        }

        $uploads = $uploadIds === null ? $message->uploads()->get() : $this->ownUploads($actor, $uploadIds, $message);
        $text = $this->validateText($text, $uploads->isNotEmpty());

        $cooked = null;

        $this->db->transaction(function () use ($message, $actor, $text, $uploads, $uploadIds, &$cooked) {
            $cooked = $this->formatter->cook($text, $message, $actor);

            $message->message = $text;
            $message->cooked = $cooked['cooked'];
            $message->edited_at = Carbon::now();
            $message->last_editor_id = (int) $actor->id;
            $message->save();

            if ($uploadIds !== null) {
                $keep = $uploads->pluck('id')->all();

                foreach (Upload::query()->where('message_id', $message->id)->whereKeyNot($keep ?: [0])->get() as $removed) {
                    $this->uploads->deleteFile($removed);
                    $removed->delete();
                }

                Upload::query()->whereIn('id', $keep ?: [0])->update(['message_id' => $message->id]);
            }
        });

        $this->afterWrite($message, $channel, $actor, false, $cooked);

        return $message;
    }

    /**
     * Menções, notificações e o aviso pelo websocket de uma mensagem gravada.
     */
    /** @param array{cooked: string, userIds: int[], here: bool, all: bool}|null $cooked */
    private function afterWrite(Message $message, Channel $channel, User $actor, bool $isNew, ?array $cooked): void
    {
        $cooked ??= ['cooked' => '', 'userIds' => [], 'here' => false, 'all' => false];

        $mentioned = [];

        try {
            $mentioned = $this->notifier->mentions($message, $channel, $actor, $cooked['userIds'], $cooked['here'], $cooked['all'], $this->notificationTitle($channel));

            if ($isNew) {
                $this->notifier->message($message, $channel, $actor, $mentioned);
            }
        } catch (\Throwable $error) {
            error_log('[ramon/canela] chat: menções/notificações falharam: '.$error->getMessage());
        }

        $this->broadcaster->toChannel($channel, [
            'type' => $isNew ? 'message.created' : 'message.updated',
            'messageId' => $message->id,
            'threadId' => $message->thread_id,
            'userId' => $message->user_id,
            'mentionedUserIds' => $mentioned,
        ]);
    }

    private function notificationTitle(Channel $channel): string
    {
        return $channel->isDirect() ? (string) ($channel->name ?? '') : (string) $channel->name;
    }

    public function deleteMessage(Message $message, Channel $channel, User $actor): void
    {
        if (! $this->access->canDeleteMessage($message, $channel, $actor)) {
            throw new PermissionDeniedException();
        }

        $this->db->transaction(function () use ($message, $channel, $actor) {
            $message->deleted_at = Carbon::now();
            $message->deleted_by_id = (int) $actor->id;
            $message->save();

            $this->refreshAfterDelete($message, $channel);
            $this->notifier->forgetMessage($message);
        });

        $this->broadcaster->toChannel($channel, [
            'type' => 'message.deleted',
            'messageId' => $message->id,
            'threadId' => $message->thread_id,
            'deletedById' => $actor->id,
            'deletedAt' => $message->deleted_at?->toAtomString(),
        ]);
    }

    public function restoreMessage(Message $message, Channel $channel, User $actor): void
    {
        if (! $this->access->canRestoreMessage($message, $channel, $actor)) {
            throw new PermissionDeniedException();
        }

        $this->db->transaction(function () use ($message, $channel) {
            $message->deleted_at = null;
            $message->deleted_by_id = null;
            $message->save();

            $this->refreshAfterDelete($message, $channel);
        });

        $this->broadcaster->toChannel($channel, ['type' => 'message.updated', 'messageId' => $message->id, 'threadId' => $message->thread_id]);
    }

    /** A última mensagem do canal e do fio, e a contagem de respostas, depois de apagar ou restaurar. */
    private function refreshAfterDelete(Message $message, Channel $channel): void
    {
        $channel->last_message_id = Message::query()->where('channel_id', $channel->id)->whereNull('deleted_at')->max('id');
        $channel->messages_count = Message::query()->where('channel_id', $channel->id)->whereNull('deleted_at')->count();
        $channel->save();

        if ($message->thread_id) {
            /** @var Thread|null $thread */
            $thread = Thread::query()->find($message->thread_id);

            if ($thread) {
                $replies = Message::query()->where('thread_id', $thread->id)->where('id', '<>', $thread->original_message_id)->whereNull('deleted_at');
                $thread->replies_count = (clone $replies)->count();
                $thread->last_message_id = (clone $replies)->max('id') ?? $thread->original_message_id;
                $thread->save();
            }
        }
    }

    /**
     * Liga ou desliga a reação do ator. Reagir pede a mesma permissão de
     * escrever; o emoji tem de ser um emoji de verdade, e cada mensagem aceita
     * no máximo 30 diferentes, como no Discourse.
     */
    public function react(Message $message, Channel $channel, User $actor, string $emoji, bool $add): void
    {
        $membership = $this->access->membership($channel, $actor);

        if ($message->isDeleted()) {
            throw new PermissionDeniedException();
        }

        $this->access->assertCanPost($channel, $actor, $membership);

        $emoji = trim($emoji);

        if (! self::isEmoji($emoji)) {
            $this->fail('emoji', 'invalid_emoji');
        }

        $existing = Reaction::query()->where('message_id', $message->id)->where('user_id', $actor->id)->where('emoji', $emoji)->first();

        if ($add && ! $existing) {
            $distinct = Reaction::query()->where('message_id', $message->id)->distinct()->pluck('emoji');

            if (! $distinct->contains($emoji) && $distinct->count() >= Reaction::MAX_PER_MESSAGE) {
                $this->fail('emoji', 'too_many_reactions', ['count' => Reaction::MAX_PER_MESSAGE]);
            }

            $reaction = new Reaction();
            $reaction->message_id = $message->id;
            $reaction->user_id = (int) $actor->id;
            $reaction->emoji = $emoji;
            $reaction->created_at = Carbon::now();
            $reaction->save();
        } elseif (! $add && $existing) {
            $existing->delete();
        } else {
            return;
        }

        $message->touch();

        $this->broadcaster->toChannel($channel, [
            'type' => 'reaction',
            'messageId' => $message->id,
            'threadId' => $message->thread_id,
            'emoji' => $emoji,
            'userId' => $actor->id,
            'action' => $add ? 'add' : 'remove',
        ], (int) $actor->id);
    }

    /**
     * Um emoji Unicode (com modificadores, ZWJ e bandeiras), nunca texto: o
     * campo vira HTML nas reações de todo mundo.
     */
    public static function isEmoji(string $value): bool
    {
        if ($value === '' || mb_strlen($value) > 16 || strlen($value) > 64) {
            return false;
        }

        return (bool) preg_match('/^(?:[\x{1F1E6}-\x{1F1FF}]{2}|[#*0-9]\x{FE0F}?\x{20E3}|\p{Extended_Pictographic}(?:\x{FE0F}|[\x{1F3FB}-\x{1F3FF}])*(?:\x{200D}\p{Extended_Pictographic}(?:\x{FE0F}|[\x{1F3FB}-\x{1F3FF}])*)*|[\x{1F3F4}][\x{E0060}-\x{E007F}]+)$/u', $value);
    }

    public function pin(Message $message, Channel $channel, User $actor, bool $pin): void
    {
        $membership = $this->access->membership($channel, $actor);

        if (! $this->access->canPin($channel, $actor, $membership) || $message->isDeleted()) {
            throw new PermissionDeniedException();
        }

        $existing = Pin::query()->where('message_id', $message->id)->first();

        if ($pin && ! $existing) {
            if (Pin::query()->where('channel_id', $channel->id)->count() >= Pin::MAX_PER_CHANNEL) {
                $this->fail('message', 'too_many_pins', ['count' => Pin::MAX_PER_CHANNEL]);
            }

            $record = new Pin();
            $record->channel_id = $channel->id;
            $record->message_id = $message->id;
            $record->pinned_by_id = (int) $actor->id;
            $record->save();

            // Quem fixa já viu a própria fixada: sem pontinho para ele.
            if ($membership) {
                $membership->last_viewed_pins_at = Carbon::now();
                $membership->save();
            }
        } elseif (! $pin && $existing) {
            $existing->delete();
        } else {
            return;
        }

        $message->touch();

        $this->broadcaster->toChannel($channel, ['type' => 'pin', 'messageId' => $message->id, 'pinned' => $pin, 'userId' => $actor->id]);
    }

    public function markPinsRead(Channel $channel, User $actor): void
    {
        $membership = $this->access->membership($channel, $actor);

        if ($membership) {
            $membership->last_viewed_pins_at = Carbon::now();
            $membership->save();
        }
    }

    // ─── Canais ─────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $attributes */
    public function createChannel(User $actor, array $attributes): Channel
    {
        if (! $this->access->canCreateChannel($actor)) {
            throw new PermissionDeniedException();
        }

        $channel = new Channel();
        $channel->type = Channel::TYPE_PUBLIC;
        $channel->created_by_id = (int) $actor->id;
        $channel->status = Channel::STATUS_OPEN;
        $channel->threading_enabled = (bool) ($attributes['threadingEnabled'] ?? false);
        $channel->allow_channel_wide_mentions = (bool) ($attributes['allowChannelWideMentions'] ?? true);
        $channel->auto_join = (bool) ($attributes['autoJoin'] ?? false);

        $tagId = isset($attributes['tagId']) && $attributes['tagId'] !== '' ? (int) $attributes['tagId'] : null;

        if ($tagId !== null) {
            $tags = $this->access->visibleTagIds($actor);

            if ($tags === null || ! in_array($tagId, $tags, true)) {
                $this->fail('tagId', 'tag_not_found');
            }
        }

        $channel->tag_id = $tagId;

        $this->fillChannel($channel, $attributes, true);

        $this->db->transaction(function () use ($channel, $actor) {
            $channel->save();
            $this->follow($channel, $actor);
        });

        return $channel;
    }

    /** @param array<string, mixed> $attributes */
    public function updateChannel(Channel $channel, User $actor, array $attributes): Channel
    {
        $membership = $this->access->membership($channel, $actor);
        $canModerate = $this->access->canModerateChannel($channel, $actor);
        $groupMember = $channel->isDirect() && $channel->is_group && $membership !== null;

        if (! $canModerate && ! $groupMember) {
            throw new PermissionDeniedException();
        }

        $this->fillChannel($channel, $attributes, false);

        if ($canModerate) {
            if (array_key_exists('threadingEnabled', $attributes)) {
                $channel->threading_enabled = (bool) $attributes['threadingEnabled'];
            }

            if (array_key_exists('allowChannelWideMentions', $attributes)) {
                $channel->allow_channel_wide_mentions = (bool) $attributes['allowChannelWideMentions'];
            }

            if (array_key_exists('autoJoin', $attributes)) {
                $channel->auto_join = (bool) $attributes['autoJoin'];
            }

            if (isset($attributes['status'])) {
                $status = array_search((string) $attributes['status'], Channel::STATUS_NAMES, true);

                // Um canal arquivado ou somente leitura não reabre (o texto do
                // Discourse: "Canais arquivados não podem ser reabertos").
                if ($status === false || ($status === Channel::STATUS_OPEN && in_array($channel->status, [Channel::STATUS_ARCHIVED, Channel::STATUS_READ_ONLY], true))) {
                    $this->fail('status', 'invalid_status');
                }

                $channel->status = (int) $status;
            }
        }

        $channel->save();

        $this->broadcaster->toChannel($channel, ['type' => 'channel.updated']);

        return $channel;
    }

    /** @param array<string, mixed> $attributes */
    private function fillChannel(Channel $channel, array $attributes, bool $creating): void
    {
        if ($creating || array_key_exists('name', $attributes)) {
            $name = trim((string) ($attributes['name'] ?? ''));

            if ($name === '' && $channel->isPublic()) {
                $this->fail('name', 'name_required');
            }

            if (mb_strlen($name) > Channel::NAME_MAX_LENGTH) {
                $this->fail('name', 'name_too_long', ['count' => Channel::NAME_MAX_LENGTH]);
            }

            $channel->name = $name === '' ? null : $name;
        }

        if ($channel->isPublic() && ($creating || array_key_exists('slug', $attributes) || array_key_exists('name', $attributes))) {
            $slug = Str::slug((string) (($attributes['slug'] ?? '') !== '' ? $attributes['slug'] : ($attributes['name'] ?? $channel->name)));
            $slug = mb_substr($slug !== '' ? $slug : 'canal', 0, 100);

            $taken = Channel::query()->where('type', Channel::TYPE_PUBLIC)->where('slug', $slug)->when($channel->exists, static fn ($q) => $q->where('id', '<>', $channel->id))->exists();

            if ($taken && ($attributes['slug'] ?? '') !== '') {
                $this->fail('slug', 'slug_taken');
            }

            $channel->slug = $taken ? mb_substr($slug, 0, 90).'-'.Str::lower(Str::random(4)) : $slug;
        }

        if (array_key_exists('description', $attributes)) {
            $description = trim((string) $attributes['description']);

            if (mb_strlen($description) > Channel::DESCRIPTION_MAX_LENGTH) {
                $this->fail('description', 'description_too_long', ['count' => Channel::DESCRIPTION_MAX_LENGTH]);
            }

            $channel->description = $description === '' ? null : $description;
        }

        if (array_key_exists('emoji', $attributes)) {
            $emoji = trim((string) $attributes['emoji']);
            $channel->emoji = $emoji !== '' && self::isEmoji($emoji) ? $emoji : null;
        }
    }

    /**
     * Apaga o canal e todo o histórico (mensagens, reações, fios, anexos), como
     * o "Excluir canal" do Discourse. Os arquivos saem antes das linhas — o
     * banco apaga as linhas em cascata, mas não sabe apagar arquivos.
     */
    public function deleteChannel(Channel $channel, User $actor): void
    {
        if (! $this->access->canModerateChannel($channel, $actor)) {
            throw new PermissionDeniedException();
        }

        $audience = $this->broadcaster->audience($channel);

        $this->purgeUploads(Message::query()->where('channel_id', $channel->id)->pluck('id')->all());

        $this->db->transaction(static function () use ($channel) {
            // As mensagens primeiro: os fios apontam para elas, e a cascata
            // pelas duas chaves ao mesmo tempo se embaralharia no MariaDB.
            Thread::query()->where('channel_id', $channel->id)->delete();
            Message::query()->where('channel_id', $channel->id)->delete();
            $channel->delete();
        });

        $this->broadcaster->send($audience, ['type' => 'channel.deleted', 'channelId' => $channel->id]);
    }

    /** @param int[] $messageIds */
    public function purgeUploads(array $messageIds): void
    {
        foreach (array_chunk($messageIds, 500) as $chunk) {
            $chunkUploads = Upload::query();
            $chunkUploads->whereIn('message_id', $chunk);

            foreach ($chunkUploads->get() as $upload) {
                $this->uploads->deleteFile($upload);
                $upload->delete();
            }
        }
    }

    /**
     * Abre a MD com essas pessoas: a que já existe com exatamente os mesmos
     * participantes, ou uma nova. Com três ou mais (contando o ator), é um chat
     * em grupo; sozinho, é a conversa consigo mesmo ("Anotar algo").
     *
     * @param int[] $userIds
     */
    public function openDirect(User $actor, array $userIds, ?string $name = null): Channel
    {
        if (! $this->access->canDirectMessage($actor)) {
            $this->fail('userIds', 'cannot_dm');
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds), static fn (int $id) => $id > 0 && $id !== (int) $actor->id)));
        $max = $this->access->settings()->dmMaxUsers();

        if (count($ids) + 1 > $max) {
            $this->fail('userIds', 'too_many_users', ['count' => $max]);
        }

        $users = User::query()->whereKey($ids ?: [0])->get();

        if ($users->count() !== count($ids)) {
            $this->fail('userIds', 'user_not_found');
        }

        foreach ($users as $user) {
            // O Discourse também recusa quem não pode (ou não quer) usar o chat.
            if (! $this->access->canUse($user)) {
                $this->fail('userIds', 'user_cannot_chat', ['username' => $user->display_name]);
            }
        }

        $all = [...$ids, (int) $actor->id];
        $name = trim((string) $name);
        $isGroup = count($all) > 2 || $name !== '';
        $key = Channel::directKey($all);

        // Um grupo com nome é sempre novo (o Discourse permite dois grupos com as
        // mesmas pessoas); sem nome, reaproveita a conversa existente.
        if (! ($isGroup && $name !== '')) {
            /** @var Channel|null $existing */
            $existing = Channel::query()->where('type', Channel::TYPE_DIRECT)->where('direct_key', $key)->first();

            if ($existing) {
                Membership::query()->where('channel_id', $existing->id)->where('user_id', $actor->id)->update(['following' => true]);

                return $existing;
            }
        }

        $channel = new Channel();
        $channel->type = Channel::TYPE_DIRECT;
        $channel->is_group = $isGroup;
        $channel->name = $name !== '' ? mb_substr($name, 0, Channel::NAME_MAX_LENGTH) : null;
        $channel->slug = $name !== '' ? mb_substr(Str::slug($name), 0, 100) : 'dm';
        $channel->threading_enabled = true;
        $channel->allow_channel_wide_mentions = true;
        $channel->created_by_id = (int) $actor->id;
        $channel->direct_key = $isGroup && $name !== '' ? null : $key;

        $this->db->transaction(function () use ($channel, $all, $actor) {
            $channel->save();

            foreach ($all as $id) {
                $membership = new Membership();
                $membership->channel_id = $channel->id;
                $membership->user_id = $id;
                // Só quem abriu a conversa a vê na lista desde já; os outros a
                // recebem com a primeira mensagem.
                $membership->following = $id === (int) $actor->id;
                $membership->notification_level = Membership::NOTIFY_ALWAYS;
                $membership->save();
            }

            $channel->user_count = count($all);
            $channel->save();
        });

        return $channel;
    }

    /**
     * Adiciona pessoas a um grupo de MD (qualquer participante) ou a um canal
     * público (a moderação).
     *
     * @param int[] $userIds
     */
    public function addMembers(Channel $channel, User $actor, array $userIds): void
    {
        $membership = $this->access->membership($channel, $actor);
        $allowed = $this->access->canModerateChannel($channel, $actor) || ($channel->isDirect() && $channel->is_group && $membership !== null);

        if (! $allowed) {
            throw new PermissionDeniedException();
        }

        $users = User::query()->whereKey(array_map('intval', $userIds) ?: [0])->get()->filter(fn (User $user) => $this->access->canUse($user));

        if ($channel->isDirect()) {
            $current = Membership::query()->where('channel_id', $channel->id)->count();
            $max = $this->access->settings()->dmMaxUsers();

            if ($current + $users->count() > $max) {
                $this->fail('userIds', 'too_many_users', ['count' => $max]);
            }
        }

        foreach ($users as $user) {
            if ($channel->isPublic() && ! $this->access->canSeeChannel($channel, $user)) {
                continue;
            }

            $member = Membership::query()->firstOrNew(['channel_id' => $channel->id, 'user_id' => $user->id]);
            $member->following = true;
            $member->notification_level = $member->exists ? $member->notification_level : ($channel->isDirect() ? Membership::NOTIFY_ALWAYS : Membership::NOTIFY_MENTION);
            $member->last_read_message_id ??= $channel->last_message_id;
            $member->save();
        }

        if ($channel->isDirect()) {
            $channel->direct_key = null;
        }

        $this->refreshUserCount($channel);
        $this->broadcaster->toChannel($channel, ['type' => 'channel.updated']);
    }

    /** @param array<string, mixed> $attributes */
    public function updateThread(Thread $thread, Channel $channel, User $actor, array $attributes): Thread
    {
        if (array_key_exists('title', $attributes)) {
            // O título é de quem abriu o fio e da moderação, como no Discourse.
            if ($thread->original_message_user_id !== $actor->id && ! $this->access->canModerateChannel($channel, $actor)) {
                throw new PermissionDeniedException();
            }

            $title = trim((string) $attributes['title']);
            $thread->title = $title === '' ? null : mb_substr($title, 0, Thread::TITLE_MAX_LENGTH);
            $thread->save();

            $this->broadcaster->toChannel($channel, ['type' => 'thread.updated', 'threadId' => $thread->id]);
        }

        if (isset($attributes['notificationLevel'])) {
            $level = array_search((string) $attributes['notificationLevel'], Thread::LEVEL_NAMES, true);

            if ($level !== false) {
                $membership = $this->threadMembership($thread, $actor, (int) $level);
                $membership->notification_level = (int) $level;
                $membership->save();
            }
        }

        return $thread;
    }
}
