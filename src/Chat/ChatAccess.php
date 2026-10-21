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

use Flarum\Extension\ExtensionManager;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Message;

/**
 * Quem pode o quê no chat.
 *
 * - Usar o chat: os grupos de `chat_allowed_groups` (administradores sempre),
 *   com o e-mail confirmado, e sem ter desligado o chat nas preferências.
 * - Ver um canal público: o canal avulso, todo mundo que usa o chat; o canal de
 *   uma tag, quem enxerga a tag (as permissões da tag valem para o canal).
 * - Ver uma mensagem direta: só os participantes — nem os administradores leem
 *   as MDs dos outros.
 * - Moderar (apagar mensagens alheias, fixar, fechar e arquivar canais):
 *   administradores e `chat_moderator_groups`.
 */
final class ChatAccess
{
    /** Preferência do usuário que desliga o chat para ele ("Ativar chat"). */
    public const PREF_ENABLED = 'canelaChatEnabled';

    /** @var array<int, int[]|null> ator => tags visíveis (null: sem o flarum/tags) */
    private array $tagCache = [];

    public function __construct(
        private readonly ChatSettings $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function settings(): ChatSettings
    {
        return $this->settings;
    }

    public function tagsEnabled(): bool
    {
        return $this->extensions->isEnabled('flarum-tags') && class_exists(\Flarum\Tags\Tag::class);
    }

    private function inGroups(User $actor, string $key): bool
    {
        if ($actor->isGuest()) {
            return false;
        }

        if ($actor->isAdmin()) {
            return true;
        }

        return (bool) array_intersect($this->settings->groups($key), $actor->permissionGroupIds());
    }

    /** Se o ator pode usar o chat, ignorando a preferência pessoal (o admin vê o que está ligado). */
    public function allowed(User $actor): bool
    {
        return $this->settings->enabled() && ! $actor->isGuest() && $this->inGroups($actor, ChatSettings::ALLOWED_GROUPS);
    }

    public function canUse(User $actor): bool
    {
        return $this->allowed($actor) && $actor->getPreference(self::PREF_ENABLED, true) !== false;
    }

    /**
     * @throws PermissionDeniedException
     */
    public function assertCanUse(User $actor): void
    {
        if (! $this->canUse($actor)) {
            throw new PermissionDeniedException();
        }
    }

    public function canModerate(User $actor): bool
    {
        return $this->allowed($actor) && $this->inGroups($actor, ChatSettings::MODERATOR_GROUPS);
    }

    public function canCreateChannel(User $actor): bool
    {
        return $this->canUse($actor) && ($actor->isAdmin() || $this->inGroups($actor, ChatSettings::CREATE_CHANNEL_GROUPS));
    }

    public function canDirectMessage(User $actor): bool
    {
        return $this->canUse($actor)
            && $this->settings->bool(ChatSettings::DM_ENABLED)
            && $this->inGroups($actor, ChatSettings::DM_GROUPS);
    }

    /** Suspenso (flarum/suspend) lê, mas não escreve. */
    public function isSuspended(User $actor): bool
    {
        $until = $actor->getAttribute('suspended_until');

        return $until instanceof \DateTimeInterface && $until > new \DateTimeImmutable();
    }

    /**
     * As tags que o ator enxerga, ou null quando o flarum/tags não está ligado
     * (então todo canal público é avulso).
     *
     * @return int[]|null
     */
    public function visibleTagIds(User $actor): ?array
    {
        if (! $this->tagsEnabled()) {
            return null;
        }

        return $this->tagCache[$actor->id ?? 0] ??= \Flarum\Tags\Tag::query()
            ->whereVisibleTo($actor)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Restringe uma consulta de canais aos que o ator enxerga.
     *
     * @param Builder<Channel> $query
     */
    public function scopeVisibleChannels(Builder $query, User $actor): void
    {
        if (! $this->canUse($actor)) {
            $query->whereRaw('1 = 0');

            return;
        }

        $tagIds = $this->visibleTagIds($actor);
        $actorId = (int) $actor->id;

        $query->where(static function (Builder $query) use ($tagIds, $actorId) {
            $query->where(static function (Builder $public) use ($tagIds) {
                $public->where('canela_chat_channels.type', Channel::TYPE_PUBLIC);

                if ($tagIds !== null) {
                    $public->where(static function (Builder $tag) use ($tagIds) {
                        $tag->whereNull('canela_chat_channels.tag_id')->orWhereIn('canela_chat_channels.tag_id', $tagIds ?: [0]);
                    });
                }
            })->orWhere(static function (Builder $direct) use ($actorId) {
                $direct->where('canela_chat_channels.type', Channel::TYPE_DIRECT)
                    ->whereExists(static function ($exists) use ($actorId) {
                        $exists->selectRaw('1')
                            ->from('canela_chat_memberships')
                            ->whereColumn('canela_chat_memberships.channel_id', 'canela_chat_channels.id')
                            ->where('canela_chat_memberships.user_id', $actorId);
                    });
            });
        });
    }

    public function canSeeChannel(Channel $channel, User $actor, ?Membership $membership = null): bool
    {
        if (! $this->canUse($actor)) {
            return false;
        }

        if ($channel->isDirect()) {
            return $membership !== null
                || Membership::query()->where('channel_id', $channel->id)->where('user_id', $actor->id)->exists();
        }

        if ($channel->tag_id === null) {
            return true;
        }

        $tagIds = $this->visibleTagIds($actor);

        return $tagIds === null || in_array($channel->tag_id, $tagIds, true);
    }

    /**
     * O canal pelo id, se o ator o enxerga; senão 404 (e não 403, para não
     * confirmar que uma MD alheia existe).
     *
     * @throws ModelNotFoundException
     */
    public function findChannel(int $id, User $actor): Channel
    {
        $this->assertCanUse($actor);

        /** @var Channel|null $channel */
        $channel = Channel::query()->find($id);

        if (! $channel || ! $this->canSeeChannel($channel, $actor)) {
            throw new ModelNotFoundException();
        }

        return $channel;
    }

    public function membership(Channel $channel, User $actor): ?Membership
    {
        /** @var Membership|null */
        return Membership::query()->where('channel_id', $channel->id)->where('user_id', $actor->id)->first();
    }

    public function canModerateChannel(Channel $channel, User $actor): bool
    {
        // Numa MD não há moderação: quem modera o fórum não lê as conversas dos outros.
        return $channel->isPublic() && $this->canModerate($actor);
    }

    /**
     * Por que o ator não pode escrever no canal, ou null quando pode. O motivo
     * vira o texto do composer ("Canal fechado, não é possível enviar…").
     */
    public function cannotPostReason(Channel $channel, User $actor, ?Membership $membership): ?string
    {
        if (! $this->canUse($actor)) {
            return 'disabled';
        }

        if ($this->isSuspended($actor)) {
            return 'silenced';
        }

        if ($channel->status === Channel::STATUS_ARCHIVED) {
            return 'archived';
        }

        if ($channel->status === Channel::STATUS_READ_ONLY) {
            return 'read_only';
        }

        if ($channel->status === Channel::STATUS_CLOSED && ! $this->canModerateChannel($channel, $actor)) {
            return 'closed';
        }

        if ($channel->isDirect() && ! $this->settings->bool(ChatSettings::DM_ENABLED)) {
            return 'disabled';
        }

        if (! $membership || ! $membership->following) {
            // Numa MD a pessoa só "saiu" da lista; escrever a traz de volta.
            return $channel->isDirect() && $membership ? null : 'not_member';
        }

        return null;
    }

    /**
     * @throws PermissionDeniedException
     */
    public function assertCanPost(Channel $channel, User $actor, ?Membership $membership): void
    {
        if ($this->cannotPostReason($channel, $actor, $membership) !== null) {
            throw new PermissionDeniedException();
        }
    }

    /** O autor edita a própria mensagem enquanto o canal aceita escrita. */
    public function canEditMessage(Message $message, Channel $channel, User $actor, ?Membership $membership): bool
    {
        return ! $message->isDeleted()
            && $message->user_id !== null
            && $message->user_id === $actor->id
            && $this->cannotPostReason($channel, $actor, $membership) === null;
    }

    public function canDeleteMessage(Message $message, Channel $channel, User $actor): bool
    {
        if ($message->isDeleted() || $channel->status === Channel::STATUS_ARCHIVED || $channel->status === Channel::STATUS_READ_ONLY) {
            return false;
        }

        if ($this->canModerateChannel($channel, $actor)) {
            return true;
        }

        return $message->user_id === $actor->id && ! $this->isSuspended($actor) && $channel->status === Channel::STATUS_OPEN;
    }

    /** Restaurar: a moderação, ou o autor quando foi ele mesmo quem apagou. */
    public function canRestoreMessage(Message $message, Channel $channel, User $actor): bool
    {
        if (! $message->isDeleted() || ($channel->status !== Channel::STATUS_OPEN && ! $this->canModerateChannel($channel, $actor))) {
            return false;
        }

        return $this->canModerateChannel($channel, $actor)
            || ($message->user_id === $actor->id && $message->deleted_by_id === $actor->id);
    }

    /** Uma mensagem apagada só aparece (recolhida) para a moderação e para o autor. */
    public function canSeeDeleted(Message $message, Channel $channel, User $actor): bool
    {
        return $message->user_id === $actor->id || $this->canModerateChannel($channel, $actor);
    }

    /** Fixar: a moderação nos canais públicos; numa MD, qualquer participante. */
    public function canPin(Channel $channel, User $actor, ?Membership $membership): bool
    {
        if (! $this->settings->bool(ChatSettings::PINS_ENABLED) || $channel->status === Channel::STATUS_ARCHIVED) {
            return false;
        }

        return $channel->isDirect() ? $membership !== null : $this->canModerateChannel($channel, $actor);
    }

    public function threadsOn(Channel $channel): bool
    {
        return $channel->threading_enabled && $this->settings->bool(ChatSettings::THREADS_ENABLED);
    }
}
