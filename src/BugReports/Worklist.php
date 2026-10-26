<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\BugReports;

/**
 * A lista de trabalho em Markdown, agrupada por página: o que uma pessoa (ou
 * um agente de IA) precisa para corrigir os relatórios abertos de uma vez.
 * Mesma ideia do `WORKLIST.md` do Bugframe (github.com/vmatheus3/bug-frame).
 */
final class Worklist
{
    private const PT = [
        'open' => 'Relatórios abertos', 'summary' => '%d relatório(s) em %d página(s).', 'reports' => 'Relatórios',
        'page' => 'Página', 'no_page' => '(sem página)', 'sent' => 'Enviado', 'by' => 'por', 'screen' => 'Tela',
        'browser' => 'Navegador', 'region' => 'Captura da área', 'full' => 'Captura da tela', 'current' => 'Texto atual',
        'suggested' => 'Texto sugerido', 'elements' => 'Elementos sob a área', 'console' => 'Erros do console',
        'note' => 'Nota da equipe',
    ];

    private const EN = [
        'open' => 'Open reports', 'summary' => '%d report(s) on %d page(s).', 'reports' => 'Reports',
        'page' => 'Page', 'no_page' => '(no page)', 'sent' => 'Sent', 'by' => 'by', 'screen' => 'Screen',
        'browser' => 'Browser', 'region' => 'Marked area screenshot', 'full' => 'Whole screen screenshot', 'current' => 'Current text',
        'suggested' => 'Suggested text', 'elements' => 'Elements under the area', 'console' => 'Console errors',
        'note' => 'Team note',
    ];

    /**
     * @param list<array<string, mixed>> $reports os relatórios já apresentados para o admin
     * @param callable(int, string): string $imageUrl o endereço de cada captura
     * @param string|null $header o começo do texto (as instruções da IA); sem ele, um título simples
     */
    public static function markdown(array $reports, string $forumTitle, callable $imageUrl, ?string $header = null, bool $portuguese = true): string
    {
        $l = $portuguese ? self::PT : self::EN;

        $byPage = [];

        foreach ($reports as $report) {
            $page = self::pageKey((string) ($report['url'] ?? ''));
            $byPage[$page][] = $report;
        }

        ksort($byPage);

        $out = $header !== null
            ? [rtrim($header), '', '## '.$l['reports'].' ('.count($reports).')', '']
            : ['# '.$l['open'].' — '.self::line($forumTitle), '', sprintf($l['summary'], count($reports), count($byPage)), ''];

        foreach ($byPage as $page => $items) {
            $out[] = '### '.$l['page'].': '.($page === '' ? $l['no_page'] : $page);
            $out[] = '';

            foreach ($items as $report) {
                $id = (int) $report['id'];
                $context = (array) ($report['context'] ?? []);
                $viewport = (array) ($context['viewport'] ?? []);

                $out[] = '#### #'.$id.' · '.$report['kind'].' · '.$report['status'];
                $out[] = '';
                $out[] = '- '.$l['sent'].': '.($report['createdAt'] ?? '').(isset($report['user']['username']) ? ' '.$l['by'].' @'.$report['user']['username'] : '');
                $out[] = '- URL: '.($report['url'] ?? '');

                if ($viewport) {
                    $out[] = '- '.$l['screen'].': '.($viewport['w'] ?? '?').'×'.($viewport['h'] ?? '?').' @'.($viewport['dpr'] ?? 1).'x'.(! empty($context['theme']) ? ' · '.$context['theme'] : '');
                }

                if (! empty($context['userAgent'])) {
                    $out[] = '- '.$l['browser'].': '.self::line((string) $context['userAgent']);
                }

                $out[] = '- '.$l['region'].': '.$imageUrl($id, 'region');

                if (! empty($report['hasFull'])) {
                    $out[] = '- '.$l['full'].': '.$imageUrl($id, 'full');
                }

                $out[] = '';
                $out[] = self::quote((string) $report['description']);
                $out[] = '';

                if (! empty($report['currentText']) || ! empty($report['suggestedText'])) {
                    $out[] = '- '.$l['current'].': '.self::line((string) ($report['currentText'] ?? ''));
                    $out[] = '- '.$l['suggested'].': '.self::line((string) ($report['suggestedText'] ?? ''));
                    $out[] = '';
                }

                $elements = (array) ($context['elements'] ?? []);

                if ($elements) {
                    $out[] = $l['elements'].':';
                    $out[] = '';

                    foreach ($elements as $element) {
                        $out[] = '- `'.str_replace('`', "'", (string) ($element['path'] ?? '')).'`'
                            .(! empty($element['text']) ? ' — "'.self::line((string) $element['text']).'"' : '');
                    }

                    $out[] = '';
                }

                $console = (array) ($context['consoleErrors'] ?? []);

                if ($console) {
                    $out[] = $l['console'].':';
                    $out[] = '';
                    $out[] = '```';

                    foreach ($console as $entry) {
                        $out[] = str_replace('```', "'''", (string) ($entry['message'] ?? ''));
                    }

                    $out[] = '```';
                    $out[] = '';
                }

                if (! empty($report['note'])) {
                    $out[] = '- '.$l['note'].': '.self::line((string) $report['note']);
                    $out[] = '';
                }
            }
        }

        return implode("\n", $out)."\n";
    }

    /** A página sem a query e o fragmento: relatórios do mesmo lugar ficam juntos. */
    public static function pageKey(string $url): string
    {
        $parts = parse_url($url);

        if (! $parts || empty($parts['host'])) {
            return '';
        }

        return ($parts['path'] ?? '/') ?: '/';
    }

    private static function line(string $text): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $text));
    }

    private static function quote(string $text): string
    {
        return implode("\n", array_map(static fn (string $line): string => '> '.$line, explode("\n", trim($text))));
    }
}
