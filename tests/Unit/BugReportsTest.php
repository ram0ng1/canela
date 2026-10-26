<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Flarum\Settings\SettingsRepositoryInterface;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\BugReports\AiPrompt;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\ImageLinks;
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

        self::assertSame(1, substr_count($markdown, '### Página: /d/9'));
        self::assertStringContainsString('### Página: /tags', $markdown);
        self::assertStringContainsString("> Quebrou\n> aqui", $markdown);
        self::assertStringContainsString('https://f.test/api/canela-bug-reports/1/full', $markdown);
        self::assertStringNotContainsString('canela-bug-reports/2/full', $markdown);
        self::assertStringContainsString('390×844 @3x', $markdown);
        self::assertSame('', Worklist::pageKey('nada'));
    }

    private function settings(): SettingsRepositoryInterface
    {
        return new class implements SettingsRepositoryInterface {
            /** @var array<string, mixed> */
            private array $values = [];

            public function all(): array
            {
                return $this->values;
            }

            public function get(string $key, mixed $default = null): mixed
            {
                return $this->values[$key] ?? $default;
            }

            public function set(string $key, mixed $value): void
            {
                $this->values[$key] = $value;
            }

            public function delete(string $keyLike): void
            {
                unset($this->values[$keyLike]);
            }
        };
    }

    public function test_link_assinado_vale_ate_vencer_e_so_para_aquela_captura(): void
    {
        $links = new ImageLinks($this->settings());
        $now = 1_800_000_000;

        parse_str(ltrim($links->query(7, 'region', $now), '?'), $q);

        self::assertTrue($links->valid(7, 'region', $q['exp'], $q['sig'], $now));
        self::assertFalse($links->valid(7, 'full', $q['exp'], $q['sig'], $now), 'outra captura do mesmo relatório');
        self::assertFalse($links->valid(8, 'region', $q['exp'], $q['sig'], $now), 'outro relatório');
        self::assertFalse($links->valid(7, 'region', $q['exp'], $q['sig'], $now + ImageLinks::LIFETIME + 1), 'vencido');
        self::assertFalse($links->valid(7, 'region', (int) $q['exp'] + 3600, $q['sig'], $now), 'validade trocada');
        self::assertFalse($links->valid(7, 'region', null, null, $now));
    }

    public function test_sem_segredo_nenhum_link_vale(): void
    {
        $links = new ImageLinks($this->settings());

        self::assertFalse($links->valid(1, 'region', time() + 60, str_repeat('a', 64)));
    }

    public function test_instrucoes_trazem_o_passo_a_passo_e_o_ambiente(): void
    {
        $forum = ['title' => 'Fórum', 'url' => 'https://f.test', 'flarum' => '2.0.2', 'theme' => '1.2.0', 'extensions' => ['flarum/tags 2.0.0']];
        $pt = AiPrompt::header($forum, 3, true);
        $en = AiPrompt::header($forum, 1, false);

        self::assertStringContainsString('Corrigir 3 problemas relatados', $pt);
        self::assertStringContainsString('Reproduza antes', $pt);
        self::assertStringContainsString('teste que falhe', $pt);
        self::assertStringContainsString('Flarum 2.0.2, tema ramon/canela 1.2.0', $pt);
        self::assertStringContainsString('flarum/tags 2.0.0', $pt);
        self::assertStringContainsString('Fix a reported problem', $en);
        self::assertStringContainsString('Reproduce before', $en);
    }

    public function test_lista_com_instrucoes_usa_o_cabecalho(): void
    {
        $markdown = Worklist::markdown(
            [['id' => 1, 'kind' => 'bug', 'status' => 'open', 'description' => 'x', 'url' => 'https://f.test/', 'context' => []]],
            'Fórum',
            static fn (int $id, string $which): string => "u/$id/$which",
            "# Instruções\n",
            false,
        );

        self::assertStringStartsWith('# Instruções', $markdown);
        self::assertStringContainsString('## Reports (1)', $markdown);
        self::assertStringContainsString('Marked area screenshot: u/1/region', $markdown);
    }
}
