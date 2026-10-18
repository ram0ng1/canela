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

use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use stdClass;

/**
 * Carrega em lote o que a API mostra da tradução: o idioma detectado e a
 * tradução de cada postagem, e o título traduzido de cada tópico, no idioma de
 * quem lê. Cada campo anota o próprio id aqui e a primeira closure resolvida
 * busca todos numa consulta por tabela (o mesmo truque do SummaryBuffer).
 */
final class TranslationBuffer
{
    /** @var array<string, array<int, true>> por tipo (`post`, `title`) e idioma */
    private static array $pending = [];

    /** @var array<string, array<int, array{locale: ?stdClass, translation: ?stdClass}>> */
    private static array $loaded = [];

    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    /**
     * @return Closure(): array{locale: ?stdClass, translation: ?stdClass}
     */
    public function post(int $postId, string $target): Closure
    {
        return $this->defer('post', $postId, $target);
    }

    /**
     * O registro do título traduzido e o idioma guardado da primeira postagem.
     *
     * @return Closure(): array{locale: ?stdClass, translation: ?stdClass}
     */
    public function title(int $discussionId, int $firstPostId, string $target): Closure
    {
        // O id da primeira postagem vai junto na chave para a busca do idioma.
        return $this->defer('title', $discussionId, $target, $firstPostId);
    }

    /**
     * @return Closure(): array{locale: ?stdClass, translation: ?stdClass}
     */
    private function defer(string $kind, int $id, string $target, int $firstPostId = 0): Closure
    {
        $bucket = "{$kind}:{$target}";

        if (! isset(self::$loaded[$bucket][$id])) {
            self::$pending[$bucket][$id] = true;
        }

        if ($firstPostId) {
            self::$firstPosts[$id] = $firstPostId;
        }

        return function () use ($bucket, $id): array {
            $this->resolve($bucket);

            return self::$loaded[$bucket][$id] ?? ['locale' => null, 'translation' => null];
        };
    }

    /** @var array<int, int> tópico → primeira postagem */
    private static array $firstPosts = [];

    private function resolve(string $bucket): void
    {
        $ids = array_keys(self::$pending[$bucket] ?? []);

        if (! $ids) {
            return;
        }

        unset(self::$pending[$bucket]);
        [$kind, $target] = explode(':', $bucket, 2);

        try {
            if ($kind === 'post') {
                $locales = $this->db->table('canela_ai_post_locales')->whereIn('post_id', $ids)->get()->keyBy('post_id');
                $translations = $this->db->table('canela_ai_post_translations')
                    ->whereIn('post_id', $ids)->where('locale', $target)->get()->keyBy('post_id');

                foreach ($ids as $id) {
                    self::$loaded[$bucket][$id] = ['locale' => $locales->get($id), 'translation' => $translations->get($id)];
                }

                return;
            }

            $firstIds = array_values(array_filter(array_map(static fn (int $id): int => self::$firstPosts[$id] ?? 0, $ids)));
            $locales = $firstIds ? $this->db->table('canela_ai_post_locales')->whereIn('post_id', $firstIds)->get()->keyBy('post_id') : collect();
            $translations = $this->db->table('canela_ai_title_translations')
                ->whereIn('discussion_id', $ids)->where('locale', $target)->get()->keyBy('discussion_id');

            foreach ($ids as $id) {
                self::$loaded[$bucket][$id] = ['locale' => $locales->get(self::$firstPosts[$id] ?? 0), 'translation' => $translations->get($id)];
            }
        } catch (QueryException $error) {
            // Tabelas por criar: tudo sai no original.
            error_log('[ramon/canela] traduções indisponíveis: '.$error->getMessage());

            foreach ($ids as $id) {
                self::$loaded[$bucket][$id] = ['locale' => null, 'translation' => null];
            }
        }
    }

    /** Depois de gravar traduções, a mesma requisição não pode servir o lote velho. */
    public static function flush(): void
    {
        self::$pending = [];
        self::$loaded = [];
        self::$generation++;
    }

    /** Muda a cada flush: quem guarda estado derivado do lote (TranslationFields) sabe que ficou velho. */
    public static int $generation = 0;
}
