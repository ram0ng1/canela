<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\Worklist;

/**
 * O que chega do navegador no "Relatar problema" é só dado: as imagens só
 * passam como data URL de imagem e com teto, e o contexto fica só com os
 * campos conhecidos, cortados.
 */
final class BugReportsTest extends TestCase
{
    private const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    public function test_data_url_de_imagem_e_decodificado(): void
    {
        $bytes = BugReportImages::decodeDataUrl('data:image/png;base64,'.self::PNG_1PX);

        self::assertNotNull($bytes);
        self::assertStringStartsWith("\x89PNG", $bytes);
    }

    public function test_recusa_o_que_nao_e_imagem_ou_passa_do_tamanho(): void
    {
        self::assertNull(BugReportImages::decodeDataUrl(null));
        self::assertNull(BugReportImages::decodeDataUrl('data:text/html;base64,PHNjcmlwdD4='));
        self::assertNull(BugReportImages::decodeDataUrl('data:image/svg+xml;base64,PHN2Zz4='));
        self::assertNull(BugReportImages::decodeDataUrl('data:image/png;base64,***'));
        self::assertNull(BugReportImages::decodeDataUrl('data:image/png;base64,'));
        self::assertNull(BugReportImages::decodeDataUrl('data:image/png;base64,'.str_repeat('A', BugReportImages::MAX_BYTES * 2)));
    }

    public function test_contexto_fica_so_com_campos_conhecidos(): void
    {
        $context = BugReportService::context([
            'url' => 'https://forum.test/d/1?x=1',
            'title' => str_repeat('t', 500),
            'viewport' => ['w' => '1280', 'h' => 720, 'dpr' => 99],
            'region' => ['x' => -5, 'y' => 10, 'w' => 300, 'h' => 200],
            'elements' => array_fill(0, 20, ['path' => 'div.a > p', 'text' => 'oi', 'extra' => 'x']),
            'consoleErrors' => [['at' => 'agora', 'message' => 'TypeError: x']],
            'secret' => 'não deve passar',
        ], false);

        self::assertSame('https://forum.test/d/1?x=1', $context['url']);
        self::assertSame(200, mb_strlen($context['title']));
        self::assertSame(['w' => 1280, 'h' => 720, 'dpr' => 10.0], $context['viewport']);
        self::assertSame(['x' => 0, 'y' => 10, 'w' => 300, 'h' => 200], $context['region']);
        self::assertCount(8, $context['elements']);
        self::assertArrayNotHasKey('extra', $context['elements'][0]);
        self::assertSame([], $context['consoleErrors'], 'sem a opção do console, os erros não entram');
        self::assertArrayNotHasKey('secret', $context);
    }

    public function test_url_que_nao_e_http_some(): void
    {
        self::assertSame('', BugReportService::context(['url' => 'javascript:alert(1)'], true)['url']);
    }

    public function test_texto_perde_caracteres_de_controle(): void
    {
        self::assertSame("linha 1\nlinha 2", BugReportService::text("  linha 1\nlinha\u{0007} 2  ", 100));
        self::assertSame('', BugReportService::text(['array'], 100));
        self::assertSame('abc', BugReportService::text('abcdef', 3));
    }

    public function test_lista_agrupa_por_pagina(): void
    {
        $report = static fn (int $id, string $url): array => [
            'id' => $id, 'kind' => 'bug', 'status' => 'open', 'description' => "Quebrou\naqui", 'url' => $url,
            'createdAt' => '2026-10-26', 'hasFull' => $id === 1, 'user' => ['username' => 'ana'],
            'context' => ['viewport' => ['w' => 390, 'h' => 844, 'dpr' => 3], 'elements' => [['path' => 'div.Post', 'text' => 'Total']], 'consoleErrors' => [['message' => 'Erro']]],
        ];

        $markdown = Worklist::markdown(
            [$report(1, 'https://f.test/d/9?near=2'), $report(2, 'https://f.test/d/9'), $report(3, 'https://f.test/tags')],
            'Fórum',
            static fn (int $id, string $which): string => "https://f.test/api/canela-bug-reports/$id/$which",
        );

        self::assertSame(1, substr_count($markdown, '## /d/9'));
        self::assertStringContainsString('## /tags', $markdown);
        self::assertStringContainsString("> Quebrou\n> aqui", $markdown);
        self::assertStringContainsString('https://f.test/api/canela-bug-reports/1/full', $markdown);
        self::assertStringNotContainsString('canela-bug-reports/2/full', $markdown);
        self::assertStringContainsString('390×844 @3x', $markdown);
        self::assertSame('', Worklist::pageKey('nada'));
    }
}
