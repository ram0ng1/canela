<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Flarum\Database\DatabaseRequirements;
use PHPUnit\Framework\TestCase;

/**
 * O MySQL/MariaDB recusa nome de índice com mais de 64 caracteres, e o
 * Laravel gera o nome a partir do prefixo, da tabela e das colunas. Com
 * prefixo de tabela, um índice sem nome explícito podia quebrar a migração
 * (como aconteceu com as reações das mensagens). A regra é a do core: o
 * prefixo aceito na instalação deixa espaço para identificadores de até
 * DatabaseRequirements::LONGEST_MIGRATION_IDENTIFIER caracteres.
 */
final class MigrationIndexNamesTest extends TestCase
{
    public function test_indices_gerados_cabem_no_limite_do_mysql(): void
    {
        $long = [];

        foreach (glob(dirname(__DIR__, 2).'/migrations/*.php') ?: [] as $file) {
            $source = (string) file_get_contents($file);

            if (! preg_match("/(?:createTable|create|table)\(\s*'([a-z0-9_]+)'/", $source, $table)) {
                continue;
            }

            preg_match_all("/->(unique|index|foreign)\(\s*(\[[^\]]*\]|'[^']*')\s*(,\s*'[^']*')?\s*\)/", $source, $calls, PREG_SET_ORDER);

            foreach ($calls as $call) {
                if (($call[3] ?? '') !== '') {
                    continue;
                }

                preg_match_all("/'([^']+)'/", $call[2], $columns);
                $name = $table[1].'_'.implode('_', $columns[1]).'_'.$call[1];

                if (strlen($name) > DatabaseRequirements::LONGEST_MIGRATION_IDENTIFIER) {
                    $long[] = basename($file).': '.$name.' ('.strlen($name).')';
                }
            }
        }

        self::assertSame([], $long, 'Dê um nome curto ao índice (segundo argumento).');
    }
}
