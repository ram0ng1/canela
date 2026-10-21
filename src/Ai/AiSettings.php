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

namespace Ramon\Canela\Ai;

use Flarum\Group\Group;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * As configurações da IA num lugar só.
 *
 * O extender, os controladores, os comandos e os campos da API precisam
 * concordar sobre o nome e o padrão de cada chave — uma chave digitada errado
 * num deles não dá erro, só faz o recurso ligar ou desligar sem motivo.
 *
 * As chaves de API (`*_KEY`) nunca vão para o fórum: só o PHP as lê, e a
 * chamada ao provedor sai daqui, nunca do navegador.
 */
final class AiSettings
{
    public const ENABLED = 'canela.ai_enabled';

    public const PROVIDER = 'canela.ai_provider';

    public const ANTHROPIC_KEY = 'canela.ai_anthropic_key';

    public const ANTHROPIC_MODEL = 'canela.ai_anthropic_model';

    public const ANTHROPIC_FAST_MODEL = 'canela.ai_anthropic_fast_model';

    public const OPENAI_URL = 'canela.ai_openai_base_url';

    public const OPENAI_KEY = 'canela.ai_openai_key';

    public const OPENAI_MODEL = 'canela.ai_openai_model';

    public const OPENAI_FAST_MODEL = 'canela.ai_openai_fast_model';

    public const BOT = 'canela.ai_bot_enabled';

    public const BOT_HEADER = 'canela.ai_bot_header_icon';

    public const BOT_SIDEBAR = 'canela.ai_bot_sidebar_link';

    public const SEARCH = 'canela.ai_search_enabled';

    public const HELPER = 'canela.ai_helper_enabled';

    public const SUMMARY = 'canela.ai_summary_enabled';

    public const SUMMARY_MIN_POSTS = 'canela.ai_summary_min_posts';

    public const GISTS = 'canela.ai_gists_enabled';

    public const RELATED = 'canela.ai_related_enabled';

    public const EMBEDDINGS_URL = 'canela.ai_embeddings_url';

    public const EMBEDDINGS_KEY = 'canela.ai_embeddings_key';

    public const EMBEDDINGS_MODEL = 'canela.ai_embeddings_model';

    public const ALLOWED_GROUPS = 'canela.ai_allowed_groups';

    public const SUMMARY_GROUPS = 'canela.ai_summary_groups';

    public const DAILY_LIMIT = 'canela.ai_daily_limit';

    public const PERSONAS = 'canela.ai_personas';

    public const DEFAULT_PERSONA = 'canela.ai_default_persona';

    /** Gravada pela última migração: sem ela as tabelas ainda não existem. */
    public const SCHEMA = 'canela.ai_schema';

    /** Tradução automática do conteúdo. */
    public const TRANSLATION = 'canela.ai_translation_enabled';

    /** Idiomas para os quais se traduz, separados por vírgula; vazio = os instalados no fórum. */
    public const TRANSLATION_LOCALES = 'canela.ai_translation_locales';

    public const TRANSLATION_TITLES = 'canela.ai_translation_titles';

    /** Chamadas ao modelo por dia, no fórum todo (a tradução serve a todos). 0 = sem limite. */
    public const TRANSLATION_DAILY_LIMIT = 'canela.ai_translation_daily_limit';

    /** Só traduz o que um visitante também veria (o `ai_translation_backfill_limit_to_public_content`). */
    public const TRANSLATION_PUBLIC_ONLY = 'canela.ai_translation_public_only';

    /** Gravada pela migração das tabelas da tradução. */
    public const TRANSLATION_SCHEMA = 'canela.ai_translation_schema';

    public const PROVIDER_ANTHROPIC = 'anthropic';

    public const PROVIDER_OPENAI = 'openai';

    /** Os modelos atuais da Anthropic; o Sonnet é o padrão, o Haiku faz as tarefas rápidas. */
    public const ANTHROPIC_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

    /**
     * Os padrões, para o extender registrar. O padrão dos grupos é o grupo
     * Membros (3): todo usuário com o e-mail confirmado — o bot aberto à
     * comunidade.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            self::ENABLED => true,
            self::PROVIDER => self::PROVIDER_ANTHROPIC,
            self::ANTHROPIC_KEY => '',
            self::ANTHROPIC_MODEL => 'claude-sonnet-5-5',
            self::ANTHROPIC_FAST_MODEL => 'claude-haiku-5-5',
            self::OPENAI_URL => 'https://api.openai.com/v1',
            self::OPENAI_KEY => '',
            self::OPENAI_MODEL => '',
            self::OPENAI_FAST_MODEL => '',
            self::BOT => true,
            self::BOT_HEADER => true,
            self::BOT_SIDEBAR => true,
            self::SEARCH => true,
            self::HELPER => true,
            self::SUMMARY => true,
            self::SUMMARY_MIN_POSTS => 3,
            // Os dois que gastam por tópico, e não por pedido de alguém, saem
            // desligados: quem liga sabe que cada tópico custa uma chamada.
            self::GISTS => false,
            self::RELATED => false,
            self::EMBEDDINGS_URL => 'https://api.openai.com/v1/embeddings',
            self::EMBEDDINGS_KEY => '',
            self::EMBEDDINGS_MODEL => 'text-embedding-3-small',
            self::ALLOWED_GROUPS => (string) Group::MEMBER_ID,
            self::SUMMARY_GROUPS => (string) Group::MEMBER_ID,
            self::DAILY_LIMIT => 50,
            self::PERSONAS => '',
            self::DEFAULT_PERSONA => 'general',
            // Desligada de saída: cada postagem lida num idioma novo custa uma chamada.
            self::TRANSLATION => false,
            self::TRANSLATION_LOCALES => '',
            self::TRANSLATION_TITLES => true,
            self::TRANSLATION_DAILY_LIMIT => 500,
            self::TRANSLATION_PUBLIC_ONLY => true,
        ];
    }

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function bool(string $key): bool
    {
        // O repositório devolve "1"/"0" do banco ou o booleano do padrão.
        return (bool) filter_var($this->settings->get($key, self::defaults()[$key] ?? false), FILTER_VALIDATE_BOOLEAN);
    }

    public function string(string $key): string
    {
        return trim((string) $this->settings->get($key, self::defaults()[$key] ?? ''));
    }

    public function int(string $key, int $min = 0, int $max = PHP_INT_MAX): int
    {
        $value = (int) $this->settings->get($key, self::defaults()[$key] ?? 0);

        return max($min, min($max, $value));
    }

    public function schemaReady(): bool
    {
        return $this->string(self::SCHEMA) === '1';
    }

    public function provider(): string
    {
        return $this->string(self::PROVIDER) === self::PROVIDER_OPENAI ? self::PROVIDER_OPENAI : self::PROVIDER_ANTHROPIC;
    }

    /**
     * Há como falar com um modelo? A Anthropic exige a chave; um servidor
     * compatível com a OpenAI pode ser local (Ollama, LM Studio) e dispensar a
     * chave, mas precisa do endereço e do modelo.
     */
    public function configured(): bool
    {
        if ($this->provider() === self::PROVIDER_ANTHROPIC) {
            return $this->string(self::ANTHROPIC_KEY) !== '';
        }

        return $this->string(self::OPENAI_URL) !== '' && $this->string(self::OPENAI_MODEL) !== '';
    }

    /** A IA está no ar: ligada, com provedor configurado e com as tabelas criadas. */
    public function available(): bool
    {
        return $this->bool(self::ENABLED) && $this->configured() && $this->schemaReady();
    }

    /** Um recurso da IA (BOT, SEARCH, HELPER, SUMMARY, GISTS, RELATED) está valendo. */
    public function feature(string $key): bool
    {
        if (! $this->available() || ! $this->bool($key)) {
            return false;
        }

        if ($key === self::RELATED) {
            return $this->embeddingsConfigured();
        }

        return true;
    }

    /** A tradução automática está valendo: IA no ar, recurso ligado e tabelas criadas. */
    public function translationReady(): bool
    {
        return $this->available() && $this->bool(self::TRANSLATION) && $this->string(self::TRANSLATION_SCHEMA) === '1';
    }

    public function embeddingsConfigured(): bool
    {
        return $this->string(self::EMBEDDINGS_URL) !== '' && $this->string(self::EMBEDDINGS_MODEL) !== '';
    }

    public function mainModel(): string
    {
        return $this->provider() === self::PROVIDER_ANTHROPIC
            ? ($this->string(self::ANTHROPIC_MODEL) ?: 'claude-sonnet-5-5')
            : $this->string(self::OPENAI_MODEL);
    }

    /** O modelo das tarefas curtas (título, etiquetas, revisão, resumos curtos). */
    public function fastModel(): string
    {
        $fast = $this->provider() === self::PROVIDER_ANTHROPIC
            ? $this->string(self::ANTHROPIC_FAST_MODEL)
            : $this->string(self::OPENAI_FAST_MODEL);

        return $fast !== '' ? $fast : $this->mainModel();
    }

    /** @return int[] */
    public function groupIds(string $key): array
    {
        $ids = array_map('intval', preg_split('/[\s,]+/', $this->string($key)) ?: []);

        return array_values(array_unique(array_filter($ids, static fn (int $id): bool => $id > 0)));
    }

    /**
     * O ator está num dos grupos da configuração? O grupo Membros não é uma
     * relação no banco — todo usuário ativado pertence a ele —, por isso entra
     * à parte, como no `User::getPermissions()` do core. Administradores
     * sempre podem: são eles que testam o recurso antes de abrir.
     */
    public function actorInGroups(User $actor, string $key): bool
    {
        if ($actor->isGuest()) {
            return false;
        }

        if ($actor->isAdmin()) {
            return true;
        }

        $allowed = $this->groupIds($key);

        if (in_array(Group::MEMBER_ID, $allowed, true) && $actor->is_email_confirmed) {
            return true;
        }

        return $actor->groups->pluck('id')->map(static fn ($id): int => (int) $id)->intersect($allowed)->isNotEmpty();
    }

    /** Pode conversar com o bot, usar o ajudante do editor e perguntar na busca. */
    public function canUse(User $actor): bool
    {
        return $this->available() && $this->actorInGroups($actor, self::ALLOWED_GROUPS);
    }

    /** Pode gerar (ou atualizar) o resumo de um tópico; ler um resumo pronto, qualquer um pode. */
    public function canSummarize(User $actor): bool
    {
        return $this->feature(self::SUMMARY) && $this->actorInGroups($actor, self::SUMMARY_GROUPS);
    }
}
