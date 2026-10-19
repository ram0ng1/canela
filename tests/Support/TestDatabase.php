<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Support;

use Illuminate\Database\Connection;
use Illuminate\Database\PostgresConnection;
use Illuminate\Database\SQLiteConnection;
use PDO;

/**
 * A conexão dos testes, nova a cada teste. Por padrão, SQLite em memória: o
 * SQL do tema é o do query builder (portável), então as regras que dependem
 * de uma escrita condicional ou de um índice único podem ser conferidas sem
 * o MariaDB.
 *
 * Com `CANELA_TEST_DB=pgsql` os mesmos testes rodam num PostgreSQL de
 * verdade (o banco mais rígido com tipos: `MAX(boolean)`, `boolean = 1`,
 * transação abortada depois de um erro). A conexão vem de `CANELA_PG_HOST`,
 * `CANELA_PG_PORT`, `CANELA_PG_DATABASE`, `CANELA_PG_USERNAME` e
 * `CANELA_PG_PASSWORD`; o schema `public` é recriado a cada teste, então use
 * um banco só para isso.
 */
final class TestDatabase
{
    public static function connection(): Connection
    {
        return match (getenv('CANELA_TEST_DB') ?: 'sqlite') {
            'pgsql' => self::postgres(),
            default => self::sqlite(),
        };
    }

    private static function sqlite(): SQLiteConnection
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Com nome: o gerenciador de transações usa o nome da conexão como chave,
        // e o Eloquent grava o nome no modelo salvo (o resolvedor conhece 'default').
        return new SQLiteConnection($pdo, ':memory:', '', ['name' => 'default']);
    }

    private static function postgres(): PostgresConnection
    {
        $env = static fn (string $key, string $default): string => (string) (getenv($key) ?: $default);
        $database = $env('CANELA_PG_DATABASE', 'canela_test');

        $pdo = new PDO(
            sprintf('pgsql:host=%s;port=%s;dbname=%s', $env('CANELA_PG_HOST', '127.0.0.1'), $env('CANELA_PG_PORT', '5432'), $database),
            $env('CANELA_PG_USERNAME', 'postgres'),
            $env('CANELA_PG_PASSWORD', 'postgres'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );

        // Cada teste começa com o banco vazio, como o SQLite em memória.
        $pdo->exec('DROP SCHEMA IF EXISTS public CASCADE');
        $pdo->exec('CREATE SCHEMA public');

        return new PostgresConnection($pdo, $database, '', ['name' => 'default', 'driver' => 'pgsql']);
    }
}
