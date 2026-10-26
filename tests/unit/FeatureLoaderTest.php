<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\TestCase;

/**
 * O extend.php carrega todo arquivo em extend/. Um recurso que não devolve
 * uma lista de extenders derruba o boot, e a lista de recursos nunca pode vir
 * da requisição.
 */
final class FeatureLoaderTest extends TestCase
{
    private function root(): string
    {
        return dirname(__DIR__, 2);
    }

    public function test_nomes_dos_recursos_sao_validos(): void
    {
        $files = glob($this->root().'/extend/*.php') ?: [];

        self::assertNotEmpty($files);

        foreach ($files as $file) {
            self::assertMatchesRegularExpression('/^[a-z][a-z0-9_-]*$/', basename($file, '.php'), 'Nome inválido em extend/: '.basename($file));
        }
    }

    public function test_todo_arquivo_de_recurso_devolve_algo(): void
    {
        foreach (glob($this->root().'/extend/*.php') ?: [] as $file) {
            self::assertMatchesRegularExpression('/^\s*return\s/m', (string) file_get_contents($file), basename($file).' precisa devolver a lista de extenders');
        }
    }

    public function test_lista_de_recursos_nao_vem_da_requisicao(): void
    {
        // Um cabeçalho ou parâmetro que mudasse os recursos deixaria qualquer
        // visitante ligar ou desligar partes do fórum.
        $source = (string) file_get_contents($this->root().'/extend.php');

        self::assertDoesNotMatchRegularExpression('/\$_(SERVER|GET|POST|REQUEST|COOKIE)\b|getallheaders\s*\(/', $source);
    }
}
