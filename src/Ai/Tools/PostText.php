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

namespace Ramon\Canela\Ai\Tools;

/**
 * O texto de um post para o modelo ler: o fonte (Markdown/BBCode) que a
 * pessoa escreveu, sem as marcações que só servem ao formatador, com os
 * espaços arrumados.
 */
final class PostText
{
    public static function plain(string $content): string
    {
        // Citações de outros posts repetem texto que já está no tópico.
        $text = (string) preg_replace('/\[quote[^\]]*\].*?\[\/quote\]/is', '', $content);
        $text = (string) preg_replace('/\[(\/?)[a-z*]+(=[^\]]*)?\]/i', '', $text);
        $text = (string) preg_replace("/[ \t]+/", ' ', $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }

    public static function excerpt(string $content, int $length): string
    {
        $text = trim((string) preg_replace('/\s+/', ' ', self::plain($content)));

        return mb_strlen($text) > $length ? rtrim(mb_substr($text, 0, $length)).'…' : $text;
    }
}
