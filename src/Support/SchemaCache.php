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

namespace Ramon\Canela\Support;

use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Throwable;

/**
 * "Esta tabela/coluna existe?" sem ir ao information_schema a cada requisição.
 *
 * Os recursos do tema conferem o esquema antes de usar tabelas que podem não
 * existir ainda (migration não rodada, extensão desligada). Cada conferência do
 * construtor de esquema é uma consulta ao information_schema, e uma página
 * logada chegava a fazer quase vinte delas (~10 ms), em toda requisição.
 *
 * Aqui as colunas de cada tabela pedida ficam no cache do Flarum, numa chave
 * que leva o número de migrations já rodadas: o `migrate` (e o `migrate:reset`)
 * mudam esse número, então o esquema novo é lido de novo sem depender de um
 * `cache:clear`. Custa uma consulta barata (`count` na tabela `migrations`) por
 * processo, só quando alguém pergunta.
 */
final class SchemaCache
{
    private const TTL = 7 * 24 * 3600;

    /** @var array<string, list<string>|null>|null tabela => colunas (minúsculas), null = não existe */
    private static ?array $tables = null;

    private static ?string $key = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $cache,
    ) {
    }

    public function hasTable(string $table): bool
    {
        return $this->columns($table) !== null;
    }

    public function hasColumn(string $table, string $column): bool
    {
        return in_array(strtolower($column), $this->columns($table) ?? [], true);
    }

    /**
     * As colunas da tabela (em minúsculas), ou null se ela não existe.
     *
     * @return list<string>|null
     */
    public function columns(string $table): ?array
    {
        $tables = $this->load();

        if (! array_key_exists($table, $tables)) {
            $schema = $this->db->getSchemaBuilder();
            $tables[$table] = $schema->hasTable($table)
                ? array_values(array_map('strtolower', $schema->getColumnListing($table)))
                : null;
            self::$tables = $tables;
            $this->persist($tables);
        }

        return $tables[$table];
    }

    /** @return array<string, list<string>|null> */
    private function load(): array
    {
        if (self::$tables !== null) {
            return self::$tables;
        }

        try {
            self::$key = 'ramon-canela.schema.'.$this->db->table('migrations')->count();
            $cached = $this->cache->get(self::$key);
        } catch (Throwable) {
            // Sem a tabela de migrations ou sem cache: só a memória do processo.
            self::$key = null;
            $cached = null;
        }

        return self::$tables = is_array($cached) ? $cached : [];
    }

    /** @param array<string, list<string>|null> $tables */
    private function persist(array $tables): void
    {
        if (self::$key === null) {
            return;
        }

        try {
            $this->cache->put(self::$key, $tables, self::TTL);
        } catch (Throwable) {
            // O cache é só atalho: sem ele, a próxima requisição confere de novo.
        }
    }
}
