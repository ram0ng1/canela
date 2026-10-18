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

namespace Ramon\Canela\RamonChat\Listener;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\Notification\Notification;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Illuminate\Contracts\Container\Container;
use Psr\Log\LoggerInterface;
use Ramon\Canela\RamonChat\Notification\ChatMentionBlueprint;
use Ramon\Canela\RamonChat\Notification\ChatMessageBlueprint;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Access\PermissionSetVisibility;
use Ramon\Chat\Access\ScopeMessageVisibility;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Event\MessageWasSent;
use Ramon\Chat\Message;
use Ramon\Chat\MessageMention;
use Ramon\Chat\ThreadUser;

/**
 * Os alertas do chat no sino, como no Discourse: "mencionou você" e "escreveu
 * em #canal" (para quem acompanha o canal no nível "Para todas as atividades",
 * ou o fio). O ramon/chat só manda a menção por e-mail.
 *
 * - @here só chega a quem esteve ativo nos últimos 5 minutos (o @all, a todos);
 * - canal silenciado, "Nunca" e quem saiu (`left_at`) não recebem nada;
 * - quem desligou o chat, ou as menções de canal inteiro, também não;
 * - quem já tem um "escreveu em" não lido do mesmo canal não ganha outro.
 *
 * Um erro aqui nunca derruba o envio: a mensagem já foi aceita.
 */
final class NotifyChatActivity
{
    /** Quem conta como "ativo agora" para o @here. */
    private const HERE_WINDOW_MINUTES = 5;

    public function __construct(
        private readonly Container $container,
    ) {
    }

    public function handle(MessageWasSent $event): void
    {
        try {
            if (! $this->container->make(RamonChatSettings::class)->enabled('bell')) {
                return;
            }

            $this->notify($event->message);
        } catch (\Throwable $error) {
            $this->container->make(LoggerInterface::class)->warning('[ramon/canela] ramon-chat: aviso no sino falhou: '.$error->getMessage());
        }
    }

    private function notify(Message $message): void
    {
        if ($message->isSystem() || $message->user_id === null || $message->channel === null) {
            return;
        }

        $authorId = (int) $message->user_id;
        $channelId = (int) $message->channel_id;

        /** @var \Illuminate\Support\Collection<int, ChannelUser> $members */
        $members = ChannelUser::query()
            ->where('channel_id', $channelId)
            ->whereNull('left_at')
            ->where('user_id', '!=', $authorId)
            ->get()
            ->keyBy('user_id');

        [$mentioned, $kinds] = $this->mentioned($message, $members);

        $syncer = $this->container->make(NotificationSyncer::class);

        // Menções agrupadas pelo tipo (você / @here / @all): o texto do aviso muda.
        foreach (['user', 'here', 'all'] as $kind) {
            $ids = array_keys(array_filter($kinds, static fn (string $value): bool => $value === $kind));
            $users = $this->recipients($message, $ids, $kind !== 'user');

            if ($users !== []) {
                $syncer->sync(new ChatMentionBlueprint($message, $kind), $users);
            }
        }

        // Quem acompanha o canal (nível 2, sem silenciar) e o fio.
        $watchers = $members
            ->filter(static fn (ChannelUser $row): bool => ! $row->muted && (int) $row->notification_level === ChannelUser::LEVEL_ALWAYS)
            ->keys()
            ->map(static fn ($id): int => (int) $id)
            ->all();

        if ($message->thread_id !== null) {
            $threadWatchers = ThreadUser::query()
                ->where('thread_id', $message->thread_id)
                ->where('notification_level', ThreadUser::LEVEL_ALWAYS)
                ->where('user_id', '!=', $authorId)
                ->pluck('user_id')
                ->map(static fn ($id): int => (int) $id)
                // Só quem ainda está no canal e não o silenciou.
                ->filter(static fn (int $id): bool => isset($members[$id]) && ! $members[$id]->muted)
                ->all();

            $watchers = array_merge($watchers, $threadWatchers);
        }

        $watchers = array_values(array_diff(array_unique($watchers), $mentioned));

        if ($watchers === []) {
            return;
        }

        // Um "escreveu em" não lido por canal: os seguintes esperam o leitor.
        $pending = Notification::query()
            ->where('type', ChatMessageBlueprint::TYPE)
            ->whereIn('user_id', $watchers)
            ->whereNull('read_at')
            ->where('is_deleted', false)
            ->whereIn('subject_id', Message::query()->select('id')->where('channel_id', $channelId))
            ->pluck('user_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $users = $this->recipients($message, array_values(array_diff($watchers, $pending)), false);

        if ($users !== []) {
            $syncer->sync(new ChatMessageBlueprint($message), $users);
        }
    }

    /**
     * Quem a mensagem menciona e como: pelo nome (ou pelo grupo) vale mais do
     * que @here/@all, que vale mais do que nada.
     *
     * @param \Illuminate\Support\Collection<int, ChannelUser> $members
     * @return array{0: list<int>, 1: array<int, 'user'|'here'|'all'>}
     */
    private function mentioned(Message $message, $members): array
    {
        $mentions = $message->mentions;

        if ($mentions->isEmpty()) {
            return [[], []];
        }

        $authorId = (int) $message->user_id;
        $kinds = [];

        foreach ($mentions->where('type', MessageMention::TYPE_USER)->pluck('user_id')->filter() as $id) {
            $kinds[(int) $id] = 'user';
        }

        // A menção de grupo alcança os membros do grupo neste canal (a mesma
        // regra do UnreadTracker do ramon/chat), e nunca convidados e membros.
        $groupIds = $mentions->where('type', MessageMention::TYPE_GROUP)->pluck('group_id')->filter()->all();

        if ($groupIds !== []) {
            $groupIds = Group::query()
                ->whereKey($groupIds)
                ->where('is_hidden', false)
                ->whereNotIn('id', [Group::GUEST_ID, Group::MEMBER_ID])
                ->pluck('id')
                ->all();
        }

        if ($groupIds !== []) {
            $inGroups = ChannelUser::query()
                ->where('channel_id', $message->channel_id)
                ->whereNull('left_at')
                ->whereIn('user_id', static fn ($sub) => $sub->select('user_id')->from('group_user')->whereIn('group_id', $groupIds))
                ->pluck('user_id');

            foreach ($inGroups as $id) {
                $kinds[(int) $id] = 'user';
            }
        }

        $all = $mentions->contains(static fn (MessageMention $m): bool => $m->type === MessageMention::TYPE_ALL);
        $here = ! $all && $mentions->contains(static fn (MessageMention $m): bool => $m->type === MessageMention::TYPE_HERE);

        if (($all || $here) && $message->channel?->allow_channel_wide_mentions !== false) {
            $wide = $members->keys()->map(static fn ($id): int => (int) $id)->all();

            if ($here && $wide !== []) {
                $wide = User::query()
                    ->whereKey($wide)
                    ->where('last_seen_at', '>=', Carbon::now()->subMinutes(self::HERE_WINDOW_MINUTES))
                    ->pluck('id')
                    ->map(static fn ($id): int => (int) $id)
                    ->all();
            }

            foreach ($wide as $id) {
                $kinds[$id] ??= $here ? 'here' : 'all';
            }
        }

        unset($kinds[$authorId]);

        // Canal silenciado ou "Nunca": nem a menção chega.
        $kinds = array_filter(
            $kinds,
            static fn (string $kind, int $id): bool => ! isset($members[$id]) || $members[$id]->wantsNotificationFor(true),
            ARRAY_FILTER_USE_BOTH
        );

        return [array_keys($kinds), $kinds];
    }

    /**
     * Quem pode mesmo receber: com o chat ligado, que ainda vê a mensagem e,
     * para @here/@all, que não desligou as menções de canal inteiro.
     *
     * @param list<int> $ids
     * @return list<User>
     */
    private function recipients(Message $message, array $ids, bool $channelWide): array
    {
        if ($ids === []) {
            return [];
        }

        $visibility = new PermissionSetVisibility();
        $out = [];

        foreach (array_chunk($ids, 200) as $chunk) {
            foreach (User::query()->whereKey($chunk)->with('groups')->get() as $user) {
                /** @var User $user */
                if ($user->getPreference('ramon-chat.enabled') === false) {
                    continue;
                }

                if ($channelWide && $user->getPreference('ramon-chat.allowChannelWideMentions') === false) {
                    continue;
                }

                if (! ScopeMessageVisibility::rowVisibleTo($user, $message, $visibility->channelVisible($user, (int) $message->channel_id))) {
                    continue;
                }

                $out[] = $user;
            }
        }

        return $out;
    }
}
