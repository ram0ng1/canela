<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Ai\Translation\LanguageDetector;

/**
 * A detecção de idioma roda na leitura dos tópicos: ela acerta as línguas
 * comuns e lê só o começo de uma postagem longa, para não pesar.
 */
final class LanguageDetectorTest extends TestCase
{
    private const PT = 'Olá a todos, eu não consegui entrar no fórum ontem porque a página de login estava com um erro e não carregava de jeito nenhum.';

    private const EN = 'Hello everyone, I could not log in to the forum yesterday because the login page had an error and it would not load at all.';

    public function test_detecta_as_linguas_comuns(): void
    {
        $detector = new LanguageDetector();

        self::assertSame('pt', $detector->detect('<t><p>'.self::PT.'</p></t>'));
        self::assertSame('en', $detector->detect('<t><p>'.self::EN.'</p></t>'));
        self::assertSame('ja', $detector->detect('<t><p>こんにちは、昨日はログインできませんでした。ページが読み込まれません。</p></t>'));
        self::assertNull($detector->detect('ok'));
    }

    public function test_postagem_longa_e_lida_so_no_comeco(): void
    {
        $detector = new LanguageDetector();
        // ~120 KB: o começo em português, o resto em inglês.
        $xml = '<r><p>'.str_repeat(self::PT.' ', 12).'</p><p>'.str_repeat(self::EN.' ', 900).'</p></r>';

        $start = hrtime(true);
        $found = $detector->detect($xml);
        $ms = (hrtime(true) - $start) / 1e6;

        self::assertSame('pt', $found, 'o idioma sai do começo do texto');
        self::assertLessThan(50, $ms, 'a detecção não pode ler a postagem inteira');
    }

    public function test_corte_no_meio_de_caractere_nao_quebra(): void
    {
        $detector = new LanguageDetector();
        $text = str_repeat('ação ', 3000);

        self::assertIsString((string) $detector->detect($text));
    }
}
