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

namespace Ramon\Canela\Ai\Translation\Api;

use Closure;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Translation\ContentTranslator;
use Ramon\Canela\Ai\Translation\LanguageDetector;
use Ramon\Canela\Ai\Translation\TranslationBuffer;

/**
 * Os campos da tradução automática na API:
 *
 * - fórum, `canelaAiTranslation`: null com o recurso desligado; senão o idioma
 *   de quem lê (null quando não é um dos idiomas alvo) e se os títulos entram;
 * - postagem: `canelaLocale` (o idioma detectado), `canelaTranslation` (o HTML
 *   traduzido, quando há) e `canelaTranslatable` (falta traduzir: o fórum pede
 *   depois de desenhar a página, sem travá-la);
 * - tópico: `canelaTitleLocale`, `canelaTitleTranslation`, `canelaTitleTranslatable`.
 *
 * A tradução só sai quando o conteúdo é o mesmo que foi traduzido
 * (`source_hash`): uma edição que escapou do evento não mostra texto velho.
 */
final class TranslationFields
{
    /** @var array<string, array{locale: ?string, html: ?string, title: ?string, translatable: bool}> */
    private array $states = [];

    /** @var array{0: int, 1: bool}|null a geração do lote e se ainda há chamadas hoje */
    private ?array $budget = null;

    public function __construct(
        private readonly AiSettings $settings,
        private readonly ContentTranslator $translator,
        private readonly TranslationBuffer $buffer,
        private readonly LanguageDetector $detector,
    ) {
    }

    public function forum(): array
    {
        return [
            Schema\Arr::make('canelaAiTranslation')
                ->nullable()
                ->get(fn (): ?array => $this->settings->translationReady() ? [
                    'locale' => $this->translator->target(),
                    'titles' => $this->settings->bool(AiSettings::TRANSLATION_TITLES),
                ] : null),
        ];
    }

    public function post(): array
    {
        $visible = fn (Post $post): bool => $post instanceof CommentPost
            && $post->hidden_at === null
            && ! $post->is_private
            && $this->translator->target() !== null;

        return [
            Schema\Str::make('canelaLocale')
                ->nullable()
                ->visible($visible)
                ->get(fn (Post $post) => $this->postState($post, static fn (array $state): ?string => $state['locale'])),

            Schema\Str::make('canelaTranslation')
                ->nullable()
                ->visible($visible)
                ->get(fn (Post $post) => $this->postState($post, static fn (array $state): ?string => $state['html'])),

            Schema\Boolean::make('canelaTranslatable')
                ->visible($visible)
                ->get(fn (Post $post) => $this->postState($post, static fn (array $state): bool => $state['translatable'])),
        ];
    }

    public function discussion(): array
    {
        $visible = fn (Discussion $discussion): bool => ! $discussion->is_private
            && $this->settings->bool(AiSettings::TRANSLATION_TITLES)
            && $this->translator->target() !== null;

        return [
            Schema\Str::make('canelaTitleLocale')
                ->nullable()
                ->visible($visible)
                ->get(fn (Discussion $discussion) => $this->titleState($discussion, static fn (array $state): ?string => $state['locale'])),

            Schema\Str::make('canelaTitleTranslation')
                ->nullable()
                ->visible($visible)
                ->get(fn (Discussion $discussion) => $this->titleState($discussion, static fn (array $state): ?string => $state['title'])),

            Schema\Boolean::make('canelaTitleTranslatable')
                ->visible($visible)
                ->get(fn (Discussion $discussion) => $this->titleState($discussion, static fn (array $state): bool => $state['translatable'])),
        ];
    }

    /**
     * @template T
     *
     * @param Closure(array{locale: ?string, html: ?string, title: ?string, translatable: bool}): T $pick
     *
     * @return Closure(): T
     */
    private function postState(Post $post, Closure $pick): Closure
    {
        $target = (string) $this->translator->target();
        $resolve = $this->buffer->post((int) $post->id, $target);

        return function () use ($post, $target, $resolve, $pick) {
            $hash = ContentTranslator::postHash($post);
            $key = "post:{$post->id}:{$target}:{$hash}:".TranslationBuffer::$generation;

            if (! isset($this->states[$key])) {
                ['locale' => $stored, 'translation' => $row] = $resolve();

                $locale = $stored && $stored->source_hash === $hash
                    ? (string) $stored->locale
                    : $this->detector->detect((string) ($post->getAttributes()['content'] ?? ''));
                $html = $row && $row->source_hash === $hash ? (string) $row->content_html : null;

                $this->states[$key] = [
                    'locale' => $html !== null ? (string) $row->source_locale : $locale,
                    'html' => $html,
                    'title' => null,
                    // Idioma por detectar também conta: o pedido detecta (com a
                    // IA, em lote) e grava, e o próximo carregamento já sabe.
                    'translatable' => $html === null
                        && ContentTranslator::fits($post)
                        && ($locale === null || ContentTranslator::differs($locale, $target))
                        && $this->hasBudget(),
                ];
            }

            return $pick($this->states[$key]);
        };
    }

    /**
     * @template T
     *
     * @param Closure(array{locale: ?string, html: ?string, title: ?string, translatable: bool}): T $pick
     *
     * @return Closure(): T
     */
    private function titleState(Discussion $discussion, Closure $pick): Closure
    {
        $target = (string) $this->translator->target();
        $resolve = $this->buffer->title((int) $discussion->id, (int) $discussion->first_post_id, $target);

        return function () use ($discussion, $target, $resolve, $pick) {
            $hash = ContentTranslator::titleHash($discussion);
            $key = "title:{$discussion->id}:{$target}:{$hash}:".TranslationBuffer::$generation;

            if (! isset($this->states[$key])) {
                ['locale' => $stored, 'translation' => $row] = $resolve();

                // O próprio título primeiro (um título em português sobre uma
                // postagem em inglês é português); sem idioma claro, o da
                // primeira postagem.
                $locale = $this->detector->detect((string) $discussion->title) ?? ($stored ? (string) $stored->locale : null);
                $title = $row && $row->source_hash === $hash ? (string) $row->title : null;
                // A "tradução" igual ao original (já estava no idioma): não há o que alternar.
                $same = $title !== null && ContentTranslator::sameText($title, (string) $discussion->title);

                $this->states[$key] = [
                    'locale' => $title !== null ? (string) $row->source_locale : $locale,
                    'html' => null,
                    'title' => $same ? null : $title,
                    'translatable' => $title === null && ($locale === null || ContentTranslator::differs($locale, $target)) && $this->hasBudget(),
                ];
            }

            return $pick($this->states[$key]);
        };
    }

    /** Ainda há chamadas hoje? Uma consulta por requisição, não uma por postagem. */
    private function hasBudget(): bool
    {
        if ($this->budget === null || $this->budget[0] !== TranslationBuffer::$generation) {
            try {
                $remaining = $this->translator->remaining();
                $this->budget = [TranslationBuffer::$generation, $remaining === null || $remaining > 0];
            } catch (\Throwable) {
                $this->budget = [TranslationBuffer::$generation, false];
            }
        }

        return $this->budget[1];
    }
}
