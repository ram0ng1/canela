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

namespace Ramon\Canela\Badges;

use Flarum\Extension\ExtensionManager;
use Ramon\Canela\Support\SchemaCache;

/**
 * O que existe neste fórum para medir: extensões (curtidas, sinalizações,
 * menções) e tabelas de outros recursos do tema (estatísticas de leitura, bio
 * do perfil estendido).
 *
 * Cada emblema e cada requisito de nível pergunta aqui antes de consultar uma
 * tabela que pode não existir. A resposta fica guardada no objeto, que é um
 * singleton: o esquema não muda no meio de uma requisição.
 */
final class Capabilities
{
    /** @var array<string, bool> */
    private array $cache = [];

    public function __construct(
        private readonly SchemaCache $schema,
        private readonly ExtensionManager $extensions,
    ) {
    }

    /**
     * As migrações dos emblemas já rodaram. Antes delas, os ouvintes não
     * fazem nada: o fórum segue no ar sem as tabelas, em vez de registrar um
     * erro a cada post.
     */
    public function installed(): bool
    {
        return $this->remember('installed', fn () => $this->hasTable('canela_user_badges') && $this->hasColumn('users', 'canela_trust_level'));
    }

    /**
     * A migração do admin de emblemas (imagem, título, concessão manual,
     * motivo) já rodou. Antes dela, esses campos não aparecem nem são gravados.
     */
    public function adminColumns(): bool
    {
        return $this->remember('adminColumns', fn () => $this->hasColumn('canela_badges', 'manual_grant') && $this->hasColumn('canela_user_badges', 'reason'));
    }

    public function likes(): bool
    {
        return $this->remember('likes', fn () => $this->extensions->isEnabled('flarum-likes') && $this->hasTable('post_likes'));
    }

    public function likeDates(): bool
    {
        return $this->remember('likeDates', fn () => $this->likes() && $this->hasColumn('post_likes', 'created_at'));
    }

    public function flags(): bool
    {
        return $this->remember('flags', fn () => $this->extensions->isEnabled('flarum-flags') && $this->hasTable('flags'));
    }

    public function mentions(): bool
    {
        return $this->remember('mentions', fn () => $this->extensions->isEnabled('flarum-mentions') && $this->hasTable('post_mentions_user'));
    }

    public function suspensions(): bool
    {
        return $this->remember('suspend', fn () => $this->extensions->isEnabled('flarum-suspend') && $this->hasColumn('users', 'suspended_until'));
    }

    /** Dias visitados, tempo e postagens lidas por dia (recurso de estatísticas). */
    public function visits(): bool
    {
        return $this->remember('visits', fn () => $this->hasTable('canela_user_visits'));
    }

    /** Quem viu cada tópico (recurso de estatísticas). */
    public function topicViews(): bool
    {
        return $this->remember('topicViews', fn () => $this->hasTable('canela_topic_views'));
    }

    /** A bio do perfil estendido. */
    public function bio(): bool
    {
        return $this->remember('bio', fn () => $this->hasColumn('users', 'canela_bio'));
    }

    /**
     * Os requisitos do emblema que este fórum consegue medir.
     *
     * @return array<string, bool> requisito => disponível
     */
    public function summary(): array
    {
        return [
            'likes' => $this->likes(),
            'flags' => $this->flags(),
            'mentions' => $this->mentions(),
            'visits' => $this->visits(),
            'topicViews' => $this->topicViews(),
            'bio' => $this->bio(),
        ];
    }

    private function hasTable(string $table): bool
    {
        return $this->schema->hasTable($table);
    }

    private function hasColumn(string $table, string $column): bool
    {
        return $this->schema->hasColumn($table, $column);
    }

    private function remember(string $key, callable $check): bool
    {
        return $this->cache[$key] ??= (bool) $check();
    }
}
