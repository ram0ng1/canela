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

use Carbon\Carbon;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Ramon\Canela\Support\Log;

/**
 * A tradução das páginas da área Sobre (Diretrizes, Termos, Privacidade e as
 * abas extras) para o idioma de quem lê.
 *
 * O modelo nunca escreve HTML: o HTML da página (o do servidor, já
 * higienizado) é lido com o DOM, só os trechos de texto vão para o modelo
 * (em JSON, em lotes) e as traduções voltam para os mesmos nós. Fora ficam o
 * código (`pre`, `code`, `kbd`, `samp`), `script` e `style`.
 *
 * A tradução fica em `canela_ai_page_translations`, por página e idioma, com
 * o hash do título e do HTML: a página editada é traduzida de novo; a mesma,
 * nunca duas vezes. Uma página longa vai em partes (o progresso fica no cache)
 * e volta "pendente" até terminar, como uma postagem longa.
 */
final class PageTranslator
{
    /** Caracteres de texto por chamada ao modelo. */
    private const BATCH_CHARS = 3500;

    /** Páginas maiores que isso ficam no original (custo). */
    public const MAX_CHARS = 60000;

    private const SKIP = ['pre', 'code', 'kbd', 'samp', 'script', 'style', 'svg', 'math'];

    public function __construct(
        private readonly ContentTranslator $translator,
        private readonly LanguageDetector $detector,
        private readonly ConnectionInterface $db,
        private readonly Cache $cache,
    ) {
    }

    /**
     * A página no idioma `$target`.
     *
     * @return array{html?: string, title?: string, locale?: string, skip?: true, pending?: true}
     */
    public function translate(string $source, string $title, string $html, string $target): array
    {
        $hash = sha1($title."\0".$html);
        $stored = $this->stored($source, $target);

        if ($stored !== null && $stored->source_hash === $hash) {
            return $stored->html === '' ? ['skip' => true] : ['html' => (string) $stored->html, 'title' => (string) $stored->title, 'locale' => (string) $stored->source_locale];
        }

        [$document, $root, $nodes] = self::parse($html);
        // Sem título próprio (as Diretrizes do admin), o fórum usa o da tradução da interface.
        $texts = $title !== '' ? ['title' => $title] : [];

        foreach ($nodes as $index => $node) {
            $texts['t'.$index] = (string) $node->nodeValue;
        }

        $plain = trim((string) preg_replace('/\s+/u', ' ', implode(' ', $texts)));

        if ($plain === '' || mb_strlen($plain) > self::MAX_CHARS) {
            return ['skip' => true];
        }

        $locale = $this->detector->detect($plain) ?? '';

        // Já no idioma de quem lê: nada a traduzir (e nada a pagar).
        if ($locale !== '' && ! ContentTranslator::differs($locale, $target)) {
            return ['skip' => true];
        }

        // Dois leitores abrindo a mesma página ao mesmo tempo não pagam duas vezes.
        $store = $this->cache->getStore();
        $lock = $store instanceof LockProvider ? $store->lock("canela-ai-translate:page-lock:{$source}:{$target}", 180) : null;

        if ($lock !== null && ! $lock->get()) {
            return ['pending' => true];
        }

        try {
            return $this->translateParts($source, $title, $html, $target, $hash, $locale, $document, $root, $nodes, $texts);
        } finally {
            $lock?->release();
        }
    }

    /**
     * @param list<DOMText> $nodes
     * @param array<string, string> $texts
     *
     * @return array{html?: string, title?: string, locale?: string, skip?: true, pending?: true}
     */
    private function translateParts(string $source, string $title, string $html, string $target, string $hash, string $locale, DOMDocument $document, DOMElement $root, array $nodes, array $texts): array
    {
        $progressKey = "canela-ai-translate:page:{$source}:{$target}:{$hash}";
        $done = $this->cache->get($progressKey);
        $done = is_array($done) ? $done : [];

        foreach (self::batches(array_diff_key($texts, $done)) as $batch) {
            $result = $this->translator->translateTexts($batch, $locale, $target);

            if ($result === null) {
                $this->cache->put($progressKey, $done, 86400);

                return ['pending' => true];
            }

            // O que o modelo não devolveu fica no original.
            $done += $result[0] + $batch;
        }

        $this->cache->forget($progressKey);

        foreach ($nodes as $index => $node) {
            $node->nodeValue = self::keepSpaces((string) $node->nodeValue, (string) ($done['t'.$index] ?? $node->nodeValue));
        }

        $translatedTitle = trim((string) ($done['title'] ?? $title)) ?: $title;
        $translatedHtml = self::innerHtml($document, $root);
        $same = ContentTranslator::sameText(strip_tags($translatedHtml).$translatedTitle, strip_tags($html).$title);

        $this->store($source, $target, $hash, $locale ?: LanguageDetector::MIXED, $same ? '' : $translatedTitle, $same ? '' : $translatedHtml);

        return $same ? ['skip' => true] : ['html' => $translatedHtml, 'title' => $translatedTitle, 'locale' => $locale ?: LanguageDetector::MIXED];
    }

    /**
     * Os nós de texto que se traduzem, na ordem do documento.
     *
     * @return array{0: DOMDocument, 1: DOMElement, 2: list<DOMText>}
     */
    public static function parse(string $html): array
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8"?><div id="canela-root">'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->getElementById('canela-root') ?? $document->documentElement;
        $nodes = [];

        $walk = static function (DOMNode $node) use (&$walk, &$nodes): void {
            foreach ($node->childNodes as $child) {
                if ($child instanceof DOMText) {
                    // Só texto com letras: espaços, números e pontuação ficam.
                    if (preg_match('/\pL/u', (string) $child->nodeValue) === 1) {
                        $nodes[] = $child;
                    }
                } elseif ($child instanceof DOMElement && ! in_array(strtolower($child->tagName), self::SKIP, true)) {
                    $walk($child);
                }
            }
        };

        if ($root instanceof DOMElement) {
            $walk($root);
        }

        /** @var DOMElement $root */
        return [$document, $root, $nodes];
    }

    /**
     * Lotes de até BATCH_CHARS caracteres, sem partir um trecho.
     *
     * @param array<string, string> $texts
     *
     * @return list<array<string, string>>
     */
    private static function batches(array $texts): array
    {
        $batches = [];
        $current = [];
        $size = 0;

        foreach ($texts as $key => $text) {
            $length = mb_strlen($text);

            if ($current !== [] && $size + $length > self::BATCH_CHARS) {
                $batches[] = $current;
                $current = [];
                $size = 0;
            }

            $current[$key] = $text;
            $size += $length;
        }

        if ($current !== []) {
            $batches[] = $current;
        }

        return $batches;
    }

    /** Os espaços das pontas do original: o texto encosta nas tags como antes. */
    private static function keepSpaces(string $original, string $translated): string
    {
        preg_match('/^\s*/u', $original, $lead);
        preg_match('/\s*$/u', $original, $trail);

        return ($lead[0] ?? '').trim($translated).($trail[0] ?? '');
    }

    private static function innerHtml(DOMDocument $document, DOMElement $root): string
    {
        $html = '';

        foreach ($root->childNodes as $child) {
            $html .= (string) $document->saveHTML($child);
        }

        return $html;
    }

    private function stored(string $source, string $target): ?object
    {
        try {
            return $this->db->table('canela_ai_page_translations')->where('source', $source)->where('locale', $target)->first();
        } catch (QueryException $error) {
            Log::warning('traduções de páginas indisponíveis: '.$error->getMessage());

            return null;
        }
    }

    private function store(string $source, string $target, string $hash, string $sourceLocale, string $title, string $html): void
    {
        try {
            $this->db->table('canela_ai_page_translations')->upsert(
                [['source' => $source, 'locale' => $target, 'source_locale' => $sourceLocale, 'title' => mb_substr($title, 0, 255), 'html' => $html, 'source_hash' => $hash, 'created_at' => Carbon::now()]],
                ['source', 'locale'],
                ['source_locale', 'title', 'html', 'source_hash', 'created_at']
            );
        } catch (QueryException $error) {
            Log::warning('tradução de página não gravada: '.$error->getMessage());
        }
    }
}
