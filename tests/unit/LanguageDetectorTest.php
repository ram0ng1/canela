<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

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

    /**
     * Títulos em português e itens em inglês (as notas de uma versão): as
     * poucas palavras comuns do inglês não bastam para dizer "inglês", e a
     * IA decide (antes saía "en" e quem lia em inglês nunca via a tradução).
     */
    public function test_linguas_misturadas_ficam_para_a_ia(): void
    {
        $detector = new LanguageDetector();
        $notes = '<r><H2>O que mudou no Tema Avocado</H2><LIST><LI>Melhoria (PR #82) por @ram0ng1</LI>'
            .'<LI>feat: Enhance TeamPage and HomePage components (PR #75) por @ram0ng1</LI></LIST>'
            .'<H2>Melhoria</H2><LIST><LI>Bump version to 2.0.0 in composer.json (PR #83) por @ram0ng1</LI>'
            .'<LI>hero banner HTML (PR #80) por @ram0ng1</LI>'
            .'<LI>Add customizable section titles for homepage settings (PR #79) por @ram0ng1</LI>'
            .'<LI>Integrate realtime updates for discussions and likes (PR #78) por @ram0ng1</LI></LIST>'
            .'<H2>Correções de Erros</H2><LIST><LI>Hide update banner in threads list (PR #84) por @ram0ng1</LI>'
            .'<LI>Version release (PR #81) por @ram0ng1</LI></LIST><H2>Como atualizar</H2></r>';

        self::assertNull($detector->detect($notes));
        self::assertSame('en', $detector->detect('Yes, we will certainly consider that in the future. But we want to run a few more events first to gain experience.'));
        self::assertSame('pt', $detector->detect('Sim, certamente consideraremos isso no futuro. Mas queremos primeiro realizar alguns eventos a mais para ganhar experiência.'));
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
