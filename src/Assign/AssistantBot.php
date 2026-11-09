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

    /** Minutos de espera antes de responder (0 = na hora), para parecer gente. */
    public const DELAY = 'canela.assistant_delay';

    public const MAX_DELAY = 1440;

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

        return $user;
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

    /** `mention`, `quote` ou `like`: a ação está ligada (e a extensão dela também). */
    public function can(string $action): bool
    {
        $key = ['mention' => self::MENTION, 'quote' => self::QUOTE, 'like' => self::LIKE][$action] ?? null;

        return $key !== null
            && (bool) $this->settings->get($key)
            && $this->extensions->isEnabled($action === 'like' ? 'flarum-likes' : 'flarum-mentions');
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
