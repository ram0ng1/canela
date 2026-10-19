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

namespace Ramon\Canela\Ai\Translation;

/**
 * Uma postagem em partes para a tradução.
 *
 * Uma postagem longa numa chamada só passava do tempo do proxy (o nginx corta
 * em 60 s, o Cloudflare em 100 s) e a tradução nunca chegava. Em partes, cada
 * pedido à API traduz algumas e guarda o progresso.
 *
 * As partes seguem os parágrafos (linhas em branco). Um bloco de código
 * (``` ou ~~~, e [code] do BBCode) vai ao modelo só como um marcador
 * (`[[CODE_3]]`) e volta no lugar dele depois: código não se traduz, e é o
 * que mais pesa num tutorial. `join` devolve o Markdown com os mesmos
 * separadores.
 */
final class PostChunks
{
    /**
     * @return list<array{text: string, source: string, codes: array<string, string>, translate: bool, glue: string}>
     *   `text` vai ao modelo (com os marcadores), `source` é o original, `glue` o separador antes da parte
     */
    public static function split(string $markdown, int $max): array
    {
        $chunks = [];
        // Cada pedaço: [texto, separador antes dele, é código, marcador].
        $parts = [];
        $size = 0;
        $codeCount = 0;

        foreach (self::blocks($markdown) as [$block, $code]) {
            if ($code) {
                $marker = '[[CODE_'.(++$codeCount).']]';
                $parts[] = [$block, "\n\n", true, $marker];
                $size += strlen($marker) + 2;

                continue;
            }

            foreach (self::fit($block, $max) as $index => $piece) {
                // Pedaços do mesmo parágrafo se juntam por quebra de linha; blocos, por linha em branco.
                $glue = $index > 0 ? "\n" : "\n\n";
                $length = mb_strlen($piece);

                if ($parts !== [] && $size + $length + 2 > $max) {
                    $chunks[] = self::chunk($parts, $chunks === []);
                    $parts = [];
                    $size = 0;
                }

                $parts[] = [$piece, $glue, false, ''];
                $size += $length + 2;
            }
        }

        if ($parts !== []) {
            $chunks[] = self::chunk($parts, $chunks === []);
        }

        return $chunks;
    }

    /**
     * Uma parte montada dos seus pedaços.
     *
     * @param non-empty-list<array{0: string, 1: string, 2: bool, 3: string}> $parts
     *
     * @return array{text: string, source: string, codes: array<string, string>, translate: bool, glue: string}
     */
    private static function chunk(array $parts, bool $first): array
    {
        $text = '';
        $source = '';
        $codes = [];
        $words = false;

        foreach ($parts as $index => [$piece, $glue, $code, $marker]) {
            $separator = $index > 0 ? $glue : '';
            $source .= $separator.$piece;

            if ($code) {
                $text .= $separator.$marker;
                $codes[$marker] = $piece;
            } else {
                $text .= $separator.$piece;
                $words = true;
            }
        }

        return [
            'text' => $text,
            'source' => $source,
            'codes' => $codes,
            // Só código: nada a traduzir, a parte vai como está.
            'translate' => $words,
            'glue' => $first ? '' : $parts[0][1],
        ];
    }

    /**
     * O texto traduzido de uma parte com o código de volta no lugar dos
     * marcadores; null quando o modelo perdeu ou repetiu algum (a parte fica
     * no original, que é melhor que código fora do lugar).
     *
     * @param array{codes: array<string, string>} $chunk
     */
    public static function restore(array $chunk, string $translated): ?string
    {
        foreach ($chunk['codes'] as $marker => $code) {
            if (substr_count($translated, $marker) !== 1) {
                return null;
            }

            // O código numa linha só, para o bloco abrir e fechar certo, mesmo
            // que o modelo tenha posto texto na linha do marcador.
            $translated = (string) preg_replace_callback(
                '/^(.*?)[ \t]*'.preg_quote($marker, '/').'[ \t]*(.*)$/m',
                static function (array $match) use ($code): string {
                    $before = rtrim($match[1]);
                    $after = ltrim($match[2]);

                    return ($before !== '' ? $before."\n" : '').$code.($after !== '' ? "\n".$after : '');
                },
                $translated,
                1
            );
        }

        return $translated;
    }

    /**
     * As partes de volta num texto só.
     *
     * @param list<array{glue: string}> $chunks
     * @param array<int, string> $texts o texto final de cada parte, pelo índice
     */
    public static function join(array $chunks, array $texts): string
    {
        $out = '';

        foreach ($chunks as $index => $chunk) {
            $out .= $chunk['glue'].($texts[$index] ?? '');
        }

        return $out;
    }

    /**
     * Os blocos separados por linha em branco; um bloco de código vai inteiro,
     * com as linhas em branco de dentro dele.
     *
     * @return list<array{0: string, 1: bool}> [texto, é código]
     */
    private static function blocks(string $markdown): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $markdown) ?: [];
        $blocks = [];
        $current = [];
        $fence = null;

        foreach ($lines as $line) {
            if ($fence !== null) {
                $current[] = $line;

                if (self::closes($line, $fence)) {
                    $fence = null;
                    self::close($blocks, $current, true);
                }

                continue;
            }

            $opening = self::opens($line);

            if ($opening !== null) {
                self::close($blocks, $current, false);
                $current[] = $line;

                // `[code]…[/code]` numa linha só já fecha ali.
                if ($opening === '[code]' && self::closes($line, $opening)) {
                    self::close($blocks, $current, true);
                } else {
                    $fence = $opening;
                }

                continue;
            }

            if (trim($line) === '') {
                self::close($blocks, $current, false);

                continue;
            }

            $current[] = $line;
        }

        // Cerca sem fechar: o resto é código, como o formatador mostra.
        self::close($blocks, $current, $fence !== null);

        return $blocks;
    }

    /**
     * Fecha o bloco em andamento (se tiver algo além de espaço).
     *
     * @param list<array{0: string, 1: bool}> $blocks
     * @param list<string> $current
     */
    private static function close(array &$blocks, array &$current, bool $code): void
    {
        if ($current !== [] && trim(implode('', $current)) !== '') {
            $blocks[] = [implode("\n", $current), $code];
        }

        $current = [];
    }

    private static function opens(string $line): ?string
    {
        if (preg_match('/^ {0,3}(`{3,}|~{3,})/', $line, $match)) {
            return $match[1];
        }

        return preg_match('/^\s*\[code(=[^\]]*)?\]/i', $line) ? '[code]' : null;
    }

    private static function closes(string $line, string $fence): bool
    {
        if ($fence === '[code]') {
            return (bool) preg_match('/\[\/code\]/i', $line);
        }

        $char = $fence[0];

        return (bool) preg_match('/^ {0,3}'.preg_quote($char, '/').'{'.strlen($fence).',}\s*$/', $line);
    }

    /**
     * Um parágrafo maior que o limite, em pedaços de linhas inteiras.
     *
     * @return list<string>
     */
    private static function fit(string $block, int $max): array
    {
        if (mb_strlen($block) <= $max) {
            return [$block];
        }

        $pieces = [];
        $piece = '';

        foreach (explode("\n", $block) as $line) {
            if ($piece !== '' && mb_strlen($piece) + mb_strlen($line) + 1 > $max) {
                $pieces[] = $piece;
                $piece = '';
            }

            $piece = $piece === '' ? $line : $piece."\n".$line;
        }

        if ($piece !== '') {
            $pieces[] = $piece;
        }

        return $pieces;
    }
}
