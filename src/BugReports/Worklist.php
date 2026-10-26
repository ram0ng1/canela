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
    /**
     * @param list<array<string, mixed>> $reports os relatórios já apresentados para o admin
     * @param callable(int, string): string $imageUrl o endereço de cada captura
     */
    public static function markdown(array $reports, string $forumTitle, callable $imageUrl): string
    {
        $byPage = [];

        foreach ($reports as $report) {
            $page = self::pageKey((string) ($report['url'] ?? ''));
            $byPage[$page][] = $report;
        }

        ksort($byPage);

        $out = ['# Relatórios abertos — '.self::line($forumTitle), '', count($reports).' relatório(s) em '.count($byPage).' página(s).', ''];

        foreach ($byPage as $page => $items) {
            $out[] = '## '.($page === '' ? '(sem página)' : $page);
            $out[] = '';

            foreach ($items as $report) {
                $id = (int) $report['id'];
                $context = (array) ($report['context'] ?? []);
                $viewport = (array) ($context['viewport'] ?? []);

                $out[] = '### #'.$id.' · '.$report['kind'].' · '.$report['status'];
                $out[] = '';
                $out[] = '- Enviado: '.($report['createdAt'] ?? '').(isset($report['user']['username']) ? ' por @'.$report['user']['username'] : '');
                $out[] = '- URL: '.($report['url'] ?? '');

                if ($viewport) {
                    $out[] = '- Tela: '.($viewport['w'] ?? '?').'×'.($viewport['h'] ?? '?').' @'.($viewport['dpr'] ?? 1).'x';
                }

                if (! empty($context['userAgent'])) {
                    $out[] = '- Navegador: '.self::line((string) $context['userAgent']);
                }

                $out[] = '- Captura da área: '.$imageUrl($id, 'region');

                if (! empty($report['hasFull'])) {
                    $out[] = '- Captura da tela: '.$imageUrl($id, 'full');
                }

                $out[] = '';
                $out[] = self::quote((string) $report['description']);
                $out[] = '';

                if (! empty($report['currentText']) || ! empty($report['suggestedText'])) {
                    $out[] = '- Texto atual: '.self::line((string) ($report['currentText'] ?? ''));
                    $out[] = '- Texto sugerido: '.self::line((string) ($report['suggestedText'] ?? ''));
                    $out[] = '';
                }

                $elements = (array) ($context['elements'] ?? []);

                if ($elements) {
                    $out[] = 'Elementos sob a área:';
                    $out[] = '';

                    foreach ($elements as $element) {
                        $out[] = '- `'.str_replace('`', "'", (string) ($element['path'] ?? '')).'`'
                            .(! empty($element['text']) ? ' — "'.self::line((string) $element['text']).'"' : '');
                    }

                    $out[] = '';
                }

                $console = (array) ($context['consoleErrors'] ?? []);

                if ($console) {
                    $out[] = 'Erros do console:';
                    $out[] = '';
                    $out[] = '```';

                    foreach ($console as $entry) {
                        $out[] = str_replace('```', "'''", (string) ($entry['message'] ?? ''));
                    }

                    $out[] = '```';
                    $out[] = '';
                }

                if (! empty($report['note'])) {
                    $out[] = '- Nota da equipe: '.self::line((string) $report['note']);
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
