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
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Throwable;

/**
 * O que existe neste fórum para medir: extensões (curtidas, sinalizações,
 * menções) e tabelas de outros recursos do tema (estatísticas de leitura, bio
 * do perfil estendido).
 *
 * Cada emblema e cada requisito de nível pergunta aqui antes de consultar uma
 * tabela que pode não existir. A resposta fica guardada no objeto, que é um
 * singleton: o esquema não muda no meio de uma requisição.
 *
 * O esquema é lido de uma vez só (a lista de tabelas numa consulta, e as
 * colunas só das quatro tabelas em que se procura coluna), e fica no cache do
 * Flarum numa chave com o número de migrations já rodadas — como o
 * SchemaCache, mas sem uma consulta ao information_schema por tabela: a
 * página dos emblemas e cada post novo perguntavam por meia dúzia delas.
 */
final class Capabilities
{
    /** As tabelas em que se procura alguma coluna; as outras só precisam existir. */
    private const COLUMN_TABLES = ['users', 'canela_badges', 'canela_user_badges', 'post_likes'];

    private const CACHE_TTL = 7 * 24 * 3600;

    /** @var array<string, bool> */
    private array $cache = [];

    /** @var array{tables: array<string, true>, columns: array<string, array<string, true>>}|null */
    private ?array $schema = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $store,
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
        return isset($this->schema()['tables'][strtolower($table)]);
    }

    private function hasColumn(string $table, string $column): bool
    {
        return isset($this->schema()['columns'][strtolower($table)][strtolower($column)]);
    }

    /** @return array{tables: array<string, true>, columns: array<string, array<string, true>>} */
    private function schema(): array
    {
        if ($this->schema !== null) {
            return $this->schema;
        }

        try {
            $key = 'ramon-canela.badges.schema.'.$this->db->table('migrations')->count();
            $cached = $this->store->get($key);
        } catch (Throwable) {
            // Sem a tabela de migrations ou sem cache: só a memória do objeto.
            $key = null;
            $cached = null;
        }

        if (is_array($cached) && isset($cached['tables'], $cached['columns'])) {
            /** @var array{tables: array<string, true>, columns: array<string, array<string, true>>} $cached */
            return $this->schema = $cached;
        }

        $this->schema = $this->readSchema();

        if ($key !== null) {
            try {
                $this->store->put($key, $this->schema, self::CACHE_TTL);
            } catch (Throwable) {
                // O cache é só atalho: sem ele, a próxima requisição lê de novo.
            }
        }

        return $this->schema;
    }

    /** @return array{tables: array<string, true>, columns: array<string, array<string, true>>} */
    private function readSchema(): array
    {
        /** @var \Illuminate\Database\Schema\Builder $builder */
        $builder = $this->db->getSchemaBuilder();
        $prefix = strtolower((string) $this->db->getTablePrefix());
        $tables = [];

        // Só o esquema atual, como o hasTable(): no PostgreSQL a lista traria
        // as tabelas de todos os esquemas do banco.
        foreach ($builder->getTables($builder->getCurrentSchemaName()) as $table) {
            $name = strtolower((string) $table['name']);

            if ($prefix === '' || str_starts_with($name, $prefix)) {
                $tables[substr($name, strlen($prefix))] = true;
            }
        }

        $columns = [];

        foreach (self::COLUMN_TABLES as $table) {
            if (isset($tables[$table])) {
                $columns[$table] = array_fill_keys(array_map('strtolower', $builder->getColumnListing($table)), true);
            }
        }

        return ['tables' => $tables, 'columns' => $columns];
    }

    private function remember(string $key, callable $check): bool
    {
        return $this->cache[$key] ??= (bool) $check();
    }
}
