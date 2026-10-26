<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * O carregador de recursos do extend.php só liga o que está em
 * extend/.enabled. Um nome errado ali desliga o recurso em silêncio; um
 * recurso que não devolve uma lista de extenders derruba o boot.
 */
final class FeatureLoaderTest extends TestCase
{
    private function root(): string
    {
        return dirname(__DIR__, 2);
    }

    /** @return list<string> */
    private function enabled(): array
    {
        // A mesma leitura do extend.php: nomes separados por espaço, quebra de linha ou vírgula.
        $text = (string) file_get_contents($this->root().'/extend/.enabled');

        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $text) ?: [])));
    }

    public function test_todo_recurso_ligado_tem_arquivo(): void
    {
        foreach ($this->enabled() as $feature) {
            self::assertMatchesRegularExpression('/^[a-z][a-z0-9_-]*$/', $feature, "Nome inválido em extend/.enabled: $feature");
            self::assertFileExists($this->root()."/extend/$feature.php", "extend/.enabled liga \"$feature\", mas extend/$feature.php não existe");
        }
    }

    public function test_recursos_nao_se_repetem(): void
    {
        $enabled = $this->enabled();

        self::assertSame(array_values(array_unique($enabled)), $enabled, 'Recurso repetido em extend/.enabled');
    }

    public function test_todo_arquivo_de_recurso_devolve_algo(): void
    {
        foreach (glob($this->root().'/extend/*.php') ?: [] as $file) {
            self::assertMatchesRegularExpression('/^\s*return\s/m', (string) file_get_contents($file), basename($file).' precisa devolver a lista de extenders');
        }
    }

    public function test_lista_de_recursos_nao_vem_da_requisicao(): void
    {
        // A lista vem só de extend/.enabled: um cabeçalho ou parâmetro que a
        // trocasse deixaria qualquer visitante ligar ou desligar recursos.
        $source = (string) file_get_contents($this->root().'/extend.php');

        self::assertDoesNotMatchRegularExpression('/\$_(SERVER|GET|POST|REQUEST|COOKIE)\b|getallheaders\s*\(/', $source);
    }
}
