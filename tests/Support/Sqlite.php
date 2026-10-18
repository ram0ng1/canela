<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Support;

use Illuminate\Database\SQLiteConnection;
use PDO;

/**
 * Uma conexão SQLite em memória, nova a cada teste: o SQL do tema é o do
 * query builder (portável), então as regras que dependem de uma escrita
 * condicional ou de um índice único podem ser conferidas sem o MariaDB.
 */
final class Sqlite
{
    public static function connection(): SQLiteConnection
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Com nome: o gerenciador de transações usa o nome da conexão como chave,
        // e o Eloquent grava o nome no modelo salvo (o resolvedor conhece 'default').
        return new SQLiteConnection($pdo, ':memory:', '', ['name' => 'default']);
    }
}
