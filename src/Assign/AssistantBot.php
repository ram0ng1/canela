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

use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Group\Group;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Ramon\Canela\System\SystemUser;

/**
 * O assistente de IA: uma conta à parte da do sistema (`assistente`) que
 * responde nos tópicos com a IA do tema (AssistantReplyJob), quando recebe um
 * tópico atribuído ou, sozinho, nas tags escolhidas. O admin cria a conta e
 * configura tudo na aba "Assistente"; o id fica em `canela.assign_bot_user_id`.
 */
final class AssistantBot
{
    public const SETTING = 'canela.assign_bot_user_id';

    /** Responde quando um tópico é atribuído a ele. */
    public const ON_ASSIGN = 'canela.assistant_on_assign';

    /** Responde sozinho nas tags de AUTO_TAGS (ids separados por vírgula). */
    public const AUTO = 'canela.assistant_auto';
    public const AUTO_TAGS = 'canela.assistant_auto_tags';

    /** `first`: só na abertura do tópico; `all`: em toda postagem nova. */
    public const AUTO_MODE = 'canela.assistant_auto_mode';

    /** O padrão da resposta: a persona (vazio = a padrão do bot), o tamanho e instruções extras. */
    public const PERSONA = 'canela.assistant_persona';
    public const LENGTH = 'canela.assistant_length';
    public const INSTRUCTIONS = 'canela.assistant_instructions';

    /** O que ele pode fazer além de escrever: mencionar, citar e curtir. */
    public const MENTION = 'canela.assistant_mention';
    public const QUOTE = 'canela.assistant_quote';
    public const LIKE = 'canela.assistant_like';

    /** Arrumar o tópico: o título (para ficar uniforme) e as tags. */
    public const RENAME = 'canela.assistant_rename';
    public const RETAG = 'canela.assistant_retag';

    /** Buscar em outras fontes: fóruns Flarum, um endereço por linha. */
    public const EXTERNAL = 'canela.assistant_external';
    public const EXTERNAL_SOURCES = 'canela.assistant_external_sources';
    public const DEFAULT_EXTERNAL_SOURCES = 'https://discuss.flarum.org';

    /** Minutos de espera antes de responder (0 = na hora), para parecer gente. */
    public const DELAY = 'canela.assistant_delay';

    public const MAX_DELAY = 1440;

    /** O grupo oculto do assistente, onde ficam as permissões só dele. */
    public const GROUP = 'canela.assistant_group_id';

    /** O que o grupo ganha ao ser criado: responder sem o captcha do fof/recaptcha. */
    private const GROUP_PERMISSIONS = ['fof-recaptcha.postWithoutCaptcha'];

    /** As que seguem as ações: ligada, o grupo tem a permissão; desligada, não. */
    private const ACTION_PERMISSIONS = [self::RENAME => 'discussion.rename', self::RETAG => 'discussion.tag'];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function id(): ?int
    {
        $id = (int) $this->settings->get(self::SETTING);

        return $id > 0 ? $id : null;
    }

    public function get(): ?User
    {
        $id = $this->id();

        return $id ? User::query()->find($id) : null;
    }

    public function is(?User $user): bool
    {
        return $user !== null && $this->id() === (int) $user->id;
    }

    /** Cria a conta, ou devolve a que já existe (dois cliques não criam duas). */
    public function create(string $bio): User
    {
        $user = $this->get();

        if ($user === null) {
            $user = SystemUser::account('assistente', $bio);
            $this->settings->set(self::SETTING, (string) $user->id);
        }

        $this->ensureGroup($user);

        return $user;
    }

    /**
     * Põe o assistente no grupo oculto "Assistente" (criado na primeira vez,
     * já com GROUP_PERMISSIONS). As permissões do Flarum vêm só dos grupos:
     * sem isso, um fórum que tirou "Postar sem reCAPTCHA" dos membros barra
     * toda resposta dele, que não tem como resolver o captcha. O admin ajusta
     * o grupo na página de permissões (responder em tags restritas, etc.).
     */
    public function ensureGroup(User $assistant): void
    {
        $group = Group::query()->find((int) $this->settings->get(self::GROUP));

        if (! $group instanceof Group) {
            $group = new Group();
            $group->name_singular = 'Assistente';
            $group->name_plural = 'Assistentes';
            $group->icon = 'fas fa-robot';
            $group->is_hidden = true;
            $group->save();

            $group->getConnection()->table('group_permission')->insert(array_map(
                static fn (string $permission) => ['group_id' => $group->id, 'permission' => $permission],
                self::GROUP_PERMISSIONS,
            ));

            $this->settings->set(self::GROUP, (string) $group->id);
        }

        foreach (self::ACTION_PERMISSIONS as $setting => $permission) {
            $rows = $group->getConnection()->table('group_permission')->where(['group_id' => $group->id, 'permission' => $permission]);

            if ((bool) $this->settings->get($setting)) {
                $rows->insertOrIgnore(['group_id' => $group->id, 'permission' => $permission]);
            } else {
                $rows->delete();
            }
        }

        if (! $assistant->groups()->whereKey($group->id)->exists()) {
            $assistant->groups()->attach($group->id);
            $assistant->unsetRelation('groups');
        }
    }

    /**
     * O processador de grupos (Extend\User::permissionGroups): o assistente
     * sempre tira as permissões de Membro e do grupo dele, mesmo que a conta
     * não esteja com o e-mail confirmado (sem isso o core o trata como
     * visitante e ignora os grupos; só o Admin, que o core checa à parte,
     * funcionava).
     *
     * @param int[] $groupIds
     * @return int[]
     */
    public function permissionGroups(User $user, array $groupIds): array
    {
        if (! $this->is($user)) {
            return $groupIds;
        }

        $group = (int) $this->settings->get(self::GROUP);

        return array_values(array_unique([...$groupIds, Group::MEMBER_ID, ...($group > 0 ? [$group] : [])]));
    }

    public function onAssign(): bool
    {
        return (bool) $this->settings->get(self::ON_ASSIGN);
    }

    public function persona(): ?string
    {
        $id = (string) $this->settings->get(self::PERSONA);

        return $id !== '' ? $id : null;
    }

    /** `short`, `medium` ou `long`. */
    public function length(): string
    {
        $length = (string) $this->settings->get(self::LENGTH);

        return in_array($length, ['short', 'long'], true) ? $length : 'medium';
    }

    public function instructions(): string
    {
        return trim((string) $this->settings->get(self::INSTRUCTIONS));
    }

    /** `mention`, `quote`, `like`, `rename`, `retag` ou `external`: a ação está ligada (e a extensão dela também). */
    public function can(string $action): bool
    {
        [$key, $extension] = [
            'mention' => [self::MENTION, 'flarum-mentions'],
            'quote' => [self::QUOTE, 'flarum-mentions'],
            'like' => [self::LIKE, 'flarum-likes'],
            'rename' => [self::RENAME, null],
            'retag' => [self::RETAG, 'flarum-tags'],
            'external' => [self::EXTERNAL, null],
        ][$action] ?? [null, null];

        return $key !== null
            && (bool) $this->settings->get($key)
            && ($extension === null || $this->extensions->isEnabled($extension));
    }

    /**
     * As fontes da busca externa: os endereços https da lista (um por linha,
     * sem a barra no fim). Sem nenhum válido, o discuss.flarum.org.
     *
     * @return list<string>
     */
    public function externalSources(): array
    {
        $sources = array_filter(
            array_map(static fn (string $line) => rtrim(trim($line), '/'), preg_split('/[\s,]+/', (string) $this->settings->get(self::EXTERNAL_SOURCES)) ?: []),
            static fn (string $url) => str_starts_with($url, 'https://') && parse_url($url, PHP_URL_HOST),
        );

        return array_slice(array_values(array_unique($sources)), 0, 10) ?: [self::DEFAULT_EXTERNAL_SOURCES];
    }

    public function delay(): int
    {
        return max(0, min(self::MAX_DELAY, (int) $this->settings->get(self::DELAY)));
    }

    public function autoMode(): string
    {
        return $this->settings->get(self::AUTO_MODE) === 'all' ? 'all' : 'first';
    }

    /**
     * A postagem pede a resposta automática: de gente (não do assistente nem
     * de outra conta do sistema), num tópico das tags escolhidas.
     */
    public function replies(CommentPost $post): bool
    {
        $author = $post->user;

        return $author !== null
            && ! $this->is($author)
            && ! str_ends_with((string) $author->email, '@'.SystemUser::EMAIL_DOMAIN)
            && $post->discussion !== null
            && $this->autoReplies($post->discussion);
    }

    /** O tópico está numa das tags da resposta automática (e ela está ligada). */
    public function autoReplies(Discussion $discussion): bool
    {
        if (! $this->settings->get(self::AUTO) || $this->id() === null) {
            return false;
        }

        $tags = array_filter(array_map('intval', explode(',', (string) $this->settings->get(self::AUTO_TAGS))));

        if ($tags === [] || ! $this->extensions->isEnabled('flarum-tags')) {
            return false;
        }

        return $discussion->getConnection()->table('discussion_tag')
            ->where('discussion_id', $discussion->id)
            ->whereIn('tag_id', $tags)
            ->exists();
    }
}
