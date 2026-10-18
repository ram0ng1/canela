<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Profile\BioRenderer;

/** A bio do perfil: texto puro com um mínimo de formatação, nunca HTML do usuário. */
final class BioRendererTest extends TestCase
{
    private function render(string $text): ?string
    {
        return (new BioRenderer())->render($text);
    }

    public function test_html_do_usuario_e_escapado(): void
    {
        self::assertSame('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>', $this->render('<script>alert(1)</script> & "x"'));
    }

    public function test_paragrafos_quebras_e_enfase(): void
    {
        self::assertSame(
            '<p><strong>forte</strong> e <em>leve</em><br><code>a*b*c</code></p><p>outro</p>',
            $this->render("**forte** e *leve*\n`a*b*c`\n\n\noutro")
        );
    }

    public function test_link_solto_sem_pontuacao_final(): void
    {
        self::assertSame(
            '<p>veja <a href="https://example.com/a" rel="ugc nofollow noopener" target="_blank">example.com/a</a>.</p>',
            $this->render('veja https://example.com/a.')
        );
    }

    public function test_parentese_da_wikipedia_fica_no_link(): void
    {
        $html = (string) $this->render('(https://pt.wikipedia.org/wiki/Canela_(especiaria))');

        self::assertStringContainsString('href="https://pt.wikipedia.org/wiki/Canela_(especiaria)"', $html);
        self::assertStringEndsWith('</a>)</p>', $html);
    }

    public function test_so_http_com_dominio_vira_link(): void
    {
        $html = (string) $this->render('javascript:alert(1) e https://x e "https://a.test/"onmouseover="x"');

        self::assertStringNotContainsString('href="javascript', $html);
        self::assertStringNotContainsString('href="https://x"', $html);
        self::assertStringNotContainsString('onmouseover="', $html);
    }

    public function test_vazio_vira_nulo(): void
    {
        self::assertNull($this->render("  \n "));
    }

    public function test_normalize_tira_controles_e_linhas_demais(): void
    {
        // U+202E (inverte a direção) disfarça o que se lê; o ZWJ monta emojis.
        self::assertSame("a\n\nb \u{1F468}\u{200D}\u{1F469}", BioRenderer::normalize("\u{202E}a\r\n\r\n\r\n\r\nb\u{0007} \u{1F468}\u{200D}\u{1F469}  "));
        self::assertNull(BioRenderer::normalize(" \n\t"));
        self::assertNull(BioRenderer::normalize(null));
    }
}
