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
 * Detecção de idioma sem custo: pelo alfabeto (cirílico, árabe, CJK…) e, no
 * alfabeto latino, pelas palavras mais comuns de cada língua.
 *
 * Responde só quando tem certeza (palavras bastantes e uma língua bem à frente
 * da segunda); na dúvida devolve null, e a IA decide em lote — o Discourse
 * também usa um detector local antes de gastar com o modelo.
 */
final class LanguageDetector
{
    /** Palavras curtas e frequentes que quase não se repetem entre as línguas. */
    private const STOPWORDS = [
        'en' => 'the and is are was were this that with have has for not you your what which would there their they from been will just about can could should does',
        'pt' => 'não você são está isso esse essa uma com mas também então muito pelo pela seu sua nós eles elas tem têm foi ainda já aqui onde porque como do da dos das ao em é um eu vocês meu minha ele ela dele dela mais pra nao voce isto',
        'es' => 'el los las pero también entonces cuando muy su sus nosotros ellos tiene fue todavía ya aquí donde porque cómo qué es son hay del al en lo y un yo me usted ustedes esto',
        'fr' => 'le les des une pour avec mais aussi alors quand très par son ses nous ils elles est sont était être avoir pas que qui dans sur cette je vous ce du au',
        'de' => 'der die das und ist sind war nicht mit für auch aber wenn sehr von sein ihre wir sie ich ein eine einen dem den zu auf noch',
        'it' => 'il gli della delle per ma anche allora molto suo sua noi loro sono era essere non che di nel sulla questo questa',
        'nl' => 'de het een en is zijn was niet met voor ook maar als zeer van haar wij zij ik dat deze die op nog wel',
    ];

    private const MIN_HITS = 3;

    /** @var array<string, array<string, true>>|null */
    private static ?array $words = null;

    /**
     * O idioma (código ISO 639-1) do texto, ou null quando não dá para saber.
     */
    public function detect(string $text): ?string
    {
        $text = self::plain($text);

        if (mb_strlen($text) < 12) {
            return null;
        }

        $script = $this->byScript($text);

        if ($script !== false) {
            return $script;
        }

        return $this->byWords($text);
    }

    /**
     * O texto que interessa para detectar e para mandar ao modelo: sem os
     * blocos de código, links e menções, que são iguais em qualquer língua.
     */
    public static function plain(string $text): string
    {
        $text = (string) preg_replace('/<(C|CODE)>.*?<\/\1>|```.*?```|`[^`]*`/su', ' ', $text);
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = (string) preg_replace('/https?:\/\/\S+|@\S+|#\S+/u', ' ', $text);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    /** O idioma pelo alfabeto; false quando o texto é latino (ou misturado). */
    private function byScript(string $text): string|false|null
    {
        $letters = max(1, (int) preg_match_all('/\p{L}/u', $text));

        $count = static fn (string $pattern): float => preg_match_all($pattern, $text) / $letters;

        if ($count('/[\p{Hiragana}\p{Katakana}]/u') > 0.1) {
            return 'ja';
        }

        if ($count('/\p{Hangul}/u') > 0.3) {
            return 'ko';
        }

        if ($count('/\p{Han}/u') > 0.3) {
            return 'zh';
        }

        foreach (['ru' => '/\p{Cyrillic}/u', 'ar' => '/\p{Arabic}/u', 'el' => '/\p{Greek}/u', 'he' => '/\p{Hebrew}/u', 'th' => '/\p{Thai}/u', 'hi' => '/\p{Devanagari}/u'] as $code => $pattern) {
            if ($count($pattern) > 0.5) {
                // Cirílico pode ser russo, ucraniano, búlgaro…: o modelo decide.
                return $code === 'ru' ? null : $code;
            }
        }

        return false;
    }

    private function byWords(string $text): ?string
    {
        self::$words ??= array_map(
            static fn (string $list): array => array_fill_keys(explode(' ', $list), true),
            self::STOPWORDS
        );

        $tokens = preg_split('/[^\p{L}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $scores = array_fill_keys(array_keys(self::$words), 0);

        foreach ($tokens as $token) {
            foreach (self::$words as $code => $words) {
                if (isset($words[$token])) {
                    $scores[$code]++;
                }
            }
        }

        arsort($scores);
        $codes = array_keys($scores);
        [$best, $second] = [$scores[$codes[0]], $scores[$codes[1]]];

        // Poucas palavras, ou duas línguas parecidas empatadas (pt/es): a IA decide.
        if ($best < self::MIN_HITS || $best < $second * 1.6) {
            return null;
        }

        return $codes[0];
    }

    /** "pt-BR" → "pt": a tradução só vale entre línguas diferentes, não entre variantes. */
    public static function base(string $locale): string
    {
        return strtolower((string) preg_split('/[-_]/', $locale)[0]);
    }

    /** Um código de idioma aceitável vindo do modelo ("en", "pt-BR", "zh-Hant"), ou null. */
    public static function normalize(mixed $code): ?string
    {
        $code = trim((string) (is_string($code) ? $code : ''));

        if (! preg_match('/^([a-zA-Z]{2,3})(?:[-_]([a-zA-Z]{2,4}))?$/', $code, $match)) {
            return null;
        }

        return strtolower($match[1]).(isset($match[2]) ? '-'.(strlen($match[2]) === 2 ? strtoupper($match[2]) : ucfirst(strtolower($match[2]))) : '');
    }
}
