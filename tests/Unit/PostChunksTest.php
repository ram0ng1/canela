<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Ai\Translation\PostChunks;

/** A postagem longa em partes: o código vai como marcador e o texto volta igual. */
final class PostChunksTest extends TestCase
{
    /** @param list<array{text: string, source: string, codes: array<string, string>, translate: bool, glue: string}> $chunks */
    private function rejoin(array $chunks): string
    {
        return PostChunks::join($chunks, array_map(static fn (array $chunk): string => $chunk['source'], $chunks));
    }

    public function test_postagem_curta_e_uma_parte_so(): void
    {
        $chunks = PostChunks::split("Olá.\n\nTudo bem?", 1000);

        self::assertCount(1, $chunks);
        self::assertTrue($chunks[0]['translate']);
        self::assertSame("Olá.\n\nTudo bem?", $this->rejoin($chunks));
    }

    public function test_bloco_de_codigo_vai_como_marcador(): void
    {
        $markdown = "Instale assim:\n\n```bash\napt install x\n\napt install y\n```\n\nPronto.";
        $chunks = PostChunks::split($markdown, 1000);

        self::assertCount(1, $chunks);
        self::assertSame("Instale assim:\n\n[[CODE_1]]\n\nPronto.", $chunks[0]['text']);
        self::assertSame("```bash\napt install x\n\napt install y\n```", $chunks[0]['codes']['[[CODE_1]]']);
        self::assertSame($markdown, $this->rejoin($chunks));

        // A tradução volta com o código no lugar do marcador.
        $restored = PostChunks::restore($chunks[0], "Install like this:\n\n[[CODE_1]]\n\nDone.");
        self::assertSame("Install like this:\n\n```bash\napt install x\n\napt install y\n```\n\nDone.", $restored);
    }

    public function test_marcador_perdido_ou_repetido_fica_no_original(): void
    {
        $chunks = PostChunks::split("Texto\n\n```\ncode\n```", 1000);

        self::assertNull(PostChunks::restore($chunks[0], 'Text'));
        self::assertNull(PostChunks::restore($chunks[0], 'Text [[CODE_1]] [[CODE_1]]'));
    }

    public function test_codigo_com_cifrao_e_barra_volta_igual(): void
    {
        $code = "```php\n\$a = '\\1' . \$0;\n```";
        $chunks = PostChunks::split("Veja\n\n".$code, 1000);

        self::assertSame("See\n\n".$code, PostChunks::restore($chunks[0], "See\n\n[[CODE_1]]"));
    }

    public function test_marcador_com_texto_na_linha_vai_para_linha_propria(): void
    {
        $chunks = PostChunks::split("Veja\n\n```\nls\n```", 1000);

        self::assertSame("See\n\nrun:\n```\nls\n```\nok", PostChunks::restore($chunks[0], "See\n\nrun: [[CODE_1]] ok"));
    }

    public function test_postagem_so_de_codigo_nao_vai_ao_modelo(): void
    {
        $chunks = PostChunks::split("```\nls\n```", 1000);

        self::assertCount(1, $chunks);
        self::assertFalse($chunks[0]['translate']);
    }

    public function test_code_do_bbcode_e_cerca_de_til(): void
    {
        $markdown = "Antes\n\n[code]a\n\nb[/code]\n\n~~~\nc\n~~~\n\nDepois";
        $chunks = PostChunks::split($markdown, 1000);

        self::assertCount(1, $chunks);
        self::assertSame("Antes\n\n[[CODE_1]]\n\n[[CODE_2]]\n\nDepois", $chunks[0]['text']);
        self::assertSame($markdown, $this->rejoin($chunks));
    }

    public function test_texto_longo_em_varias_partes_no_limite(): void
    {
        $paragraphs = array_map(static fn (int $i): string => trim(str_repeat("palavra{$i} ", 40)), range(1, 20));
        $markdown = implode("\n\n", $paragraphs);
        $chunks = PostChunks::split($markdown, 1000);

        self::assertGreaterThan(5, count($chunks));

        foreach ($chunks as $chunk) {
            self::assertLessThanOrEqual(1000, mb_strlen($chunk['text']));
        }

        self::assertSame($markdown, $this->rejoin($chunks));
    }

    public function test_paragrafo_enorme_quebra_em_linhas_sem_virar_paragrafos(): void
    {
        $lines = array_map(static fn (int $i): string => "- item {$i} ".str_repeat('x', 80), range(1, 30));
        $markdown = implode("\n", $lines);
        $chunks = PostChunks::split($markdown, 500);

        self::assertGreaterThan(1, count($chunks));
        self::assertSame("\n", $chunks[1]['glue']);
        self::assertSame($markdown, $this->rejoin($chunks));
    }

    public function test_cerca_sem_fechar_e_codigo_ate_o_fim(): void
    {
        $chunks = PostChunks::split("Texto\n\n```\nsem fim\n\nmais", 1000);

        self::assertSame("Texto\n\n[[CODE_1]]", $chunks[0]['text']);
        self::assertSame("```\nsem fim\n\nmais", $chunks[0]['codes']['[[CODE_1]]']);
    }
}
