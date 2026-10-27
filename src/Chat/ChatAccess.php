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
use Flarum\Group\Group;
use Flarum\Group\Permission;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Support\Collection;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Message;

/**
 * Quem pode o quê no chat: a fachada que o resto do chat consulta.
 *
 * As decisões não moram aqui. As globais são permissões do Flarum
 * (`group_permission`, em Administração → Permissões) perguntadas com
 * `$actor->can()`; as de um canal, mensagem ou fio são das policies
 * (Access\ChannelPolicy, MessagePolicy, ThreadPolicy). Outra extensão estende
 * qualquer uma delas com uma policy própria, como faria com as do core.
 *
 * - Usar o chat: `canela.chat.use` (administradores sempre), com o e-mail
 *   confirmado e sem ter desligado o chat nas preferências.
 * - Mandar MD: `canela.chat.directMessage`, com as MDs ligadas no admin.
 * - Criar canal público: `canela.chat.createChannel`.
 * - Moderar (apagar mensagens alheias, fixar, fechar e arquivar canais):
 *   `canela.chat.moderate`, só nos canais públicos.
 *
 * Aqui ficam também os caches de cada ator, para uma lista de mensagens não
 * repetir uma consulta por mensagem: as tags que ele enxerga, os grupos com
 * cada permissão e as participações que a montagem da resposta já carregou.
 * Ficam presos ao objeto do ator (WeakMap): cada requisição carrega o seu, e o
 * cache some com ele.
 */
final class ChatAccess
{
    /** Preferência do usuário que desliga o chat para ele ("Ativar chat"). */
    public const PREF_ENABLED = 'canelaChatEnabled';

    public const PERMISSION_USE = 'canela.chat.use';

    public const PERMISSION_DIRECT_MESSAGE = 'canela.chat.directMessage';

    public const PERMISSION_CREATE_CHANNEL = 'canela.chat.createChannel';

    public const PERMISSION_MODERATE = 'canela.chat.moderate';

    /** @var \WeakMap<User, ActorCache> */
    private \WeakMap $actors;

    public function __construct(
        private readonly ChatSettings $settings,
        private readonly ExtensionManager $extensions,
    ) {
        $this->actors = new \WeakMap();
    }

    public function settings(): ChatSettings
    {
        return $this->settings;
    }

    public function tagsEnabled(): bool
    {
        return $this->extensions->isEnabled('flarum-tags') && class_exists(\Flarum\Tags\Tag::class);
    }

    // ─── Permissões globais ─────────────────────────────────────────────────

    /**
     * Se o ator pode usar o chat, ignorando a preferência pessoal (o admin vê o que está ligado).
     *
     * Para o suspenso, valem os grupos de verdade dele: o flarum/suspend troca
     * os grupos de permissão por [Visitante], e com eles a pessoa perderia até
     * a leitura. Suspenso lê; quem barra a escrita é o isSuspended() (motivo
     * "silenced"). Moderar, criar canal e mandar MD seguem com os grupos de
     * permissão — suspenso não faz nada disso.
     */
    public function allowed(User $actor): bool
    {
        if (! $this->settings->enabled() || $actor->isGuest()) {
            return false;
        }

        if ($this->isSuspended($actor)) {
            $groups = $this->realGroupIds($actor);

            // Administrador suspenso também lê, como o Flarum libera tudo para ele.
            return in_array(Group::ADMINISTRATOR_ID, $groups, true)
                || array_intersect($this->groupsWith($actor, self::PERMISSION_USE), $groups) !== [];
        }

        return $actor->can(self::PERMISSION_USE);
    }

    /**
     * Os grupos que têm a permissão, uma consulta por ator.
     *
     * @return int[]
     */
    private function groupsWith(User $actor, string $permission): array
    {
        $cache = $this->cache($actor);

        return $cache->granted[$permission] ??= Permission::query()
            ->where('permission', $permission)
            ->pluck('group_id')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    private function cache(User $actor): ActorCache
    {
        if (! $this->actors->offsetExists($actor)) {
            $this->actors[$actor] = new ActorCache();
        }

        return $this->actors[$actor];
    }

    /**
     * Os grupos da pessoa sem os processadores de grupo (o do flarum/suspend
     * entre eles): Visitante, Membro com o e-mail confirmado e os grupos da
     * relação — o mesmo cálculo do User::permissionGroupIds() do core.
     *
     * @return list<int>
     */
    private function realGroupIds(User $actor): array
    {
        $ids = [Group::GUEST_ID];

        if ($actor->is_email_confirmed) {
            $ids[] = Group::MEMBER_ID;

            foreach ($actor->groups as $group) {
                $ids[] = (int) $group->id;
            }
        }

        return $ids;
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
        return $this->allowed($actor) && $actor->can(self::PERMISSION_MODERATE);
    }

    public function canCreateChannel(User $actor): bool
    {
        return $this->canUse($actor) && $actor->can(self::PERMISSION_CREATE_CHANNEL);
    }

    public function canDirectMessage(User $actor): bool
    {
        return $this->canUse($actor)
            && $this->settings->bool(ChatSettings::DM_ENABLED)
            && $actor->can(self::PERMISSION_DIRECT_MESSAGE);
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

        $cache = $this->cache($actor);

        if (! $cache->tagsLoaded) {
            $cache->tags = \Flarum\Tags\Tag::query()
                ->whereVisibleTo($actor)
                ->pluck('id')
                ->map(static fn ($id) => (int) $id)
                ->all();
            $cache->tagsLoaded = true;
        }

        return $cache->tags;
    }

    // ─── Participações ──────────────────────────────────────────────────────

    /**
     * A participação do ator no canal. A que a montagem da resposta já
     * carregou em lote (primeMemberships) vem do cache; fora dela, uma
     * consulta — e nunca guardada, porque a ação que pergunta costuma ser a
     * que muda a participação logo em seguida.
     */
    public function membership(Channel $channel, User $actor): ?Membership
    {
        $primed = $this->cache($actor)->memberships;

        if (array_key_exists($channel->id, $primed)) {
            return $primed[$channel->id];
        }

        /** @var Membership|null */
        return Membership::query()->where('channel_id', $channel->id)->where('user_id', $actor->id)->first();
    }

    /**
     * Guarda as participações do ator nesses canais (as que faltam, numa
     * consulta), para as policies não consultarem uma por mensagem.
     *
     * Só a montagem da resposta chama, depois de todas as escritas.
     *
     * @param int[] $channelIds
     * @param Collection<int, Membership>|null $loaded as já carregadas, por canal
     */
    public function primeMemberships(User $actor, array $channelIds, ?Collection $loaded = null): void
    {
        $cache = $this->cache($actor);
        $missing = array_values(array_diff($channelIds, array_keys($cache->memberships)));

        if (! $missing) {
            return;
        }

        $loaded ??= Membership::query()->where('user_id', $actor->id)->whereIn('channel_id', $missing)->get()->keyBy('channel_id');

        foreach ($missing as $id) {
            $cache->memberships[$id] = $loaded->get($id);
        }
    }

    // ─── Canais e mensagens (pelas policies) ────────────────────────────────

    public function canSeeChannel(Channel $channel, User $actor): bool
    {
        return $actor->can('view', $channel);
    }

    public function canModerateChannel(Channel $channel, User $actor): bool
    {
        return $actor->can('moderate', $channel);
    }

    /**
     * Por que o ator não pode escrever no canal, ou null quando pode. O motivo
     * vira o texto do composer ("Canal fechado, não é possível enviar…").
     *
     * É a regra que a ChannelPolicy usa para `post`; o motivo em si não cabe
     * numa resposta sim/não, por isso mora aqui.
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

    /** Uma mensagem apagada só aparece (recolhida) para a moderação e para o autor. */
    public function canSeeDeleted(Message $message, Channel $channel, User $actor): bool
    {
        return $message->user_id === $actor->id || $this->canModerateChannel($channel, $actor);
    }

    public function threadsOn(Channel $channel): bool
    {
        return $channel->threading_enabled && $this->settings->bool(ChatSettings::THREADS_ENABLED);
    }
}
