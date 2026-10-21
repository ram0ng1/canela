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

namespace Ramon\Canela\Ai\Summaries;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\CommentPost;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Collection;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Llm\LlmFactory;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Ai\Llm\LlmResult;
use Ramon\Canela\Ai\Tools\PostText;
use Ramon\Canela\Ai\TopicSummary;

/**
 * Os resumos de IA de um tópico: o completo ("Resumir", no mapa do tópico) e
 * o curto (gist), da lista.
 *
 * O resumo é guardado e mostrado a todos que veem o tópico. Por isso só
 * entram os posts que qualquer leitor do tópico vê:
 * nem os ocultos, nem os que esperam aprovação — mesmo quando quem pediu é
 * um moderador que os enxerga.
 *
 * Num tópico longo vão os primeiros posts (o assunto) e os últimos (onde a
 * conversa chegou), num teto de texto.
 */
final class TopicSummarizer
{
    private const HEAD = 10;

    private const TAIL = 50;

    private const MAX_CHARS = 60000;

    public function __construct(
        private readonly AiSettings $settings,
        private readonly LlmFactory $llm,
    ) {
    }

    public function find(Discussion $discussion): ?TopicSummary
    {
        return TopicSummary::query()->find($discussion->id);
    }

    /**
     * O estado do resumo para o painel: o texto, quando foi feito, com que
     * modelo, se está desatualizado e quantas postagens faltam nele.
     *
     * @return array<string, mixed>|null
     */
    public function present(Discussion $discussion, ?TopicSummary $summary, bool $canGenerate): ?array
    {
        if (! $summary || $summary->summary === null || $summary->summary === '') {
            return null;
        }

        $outdated = (int) $discussion->last_post_number > (int) $summary->summary_post_number;

        return [
            'text' => $summary->summary,
            'updatedAt' => $summary->summary_updated_at?->toAtomString(),
            'model' => $summary->summary_model,
            'outdated' => $outdated,
            'newPostsSinceSummary' => max(0, (int) $discussion->comment_count - (int) $summary->summary_post_count),
            'canRegenerate' => $outdated && $canGenerate,
        ];
    }

    /**
     * @param callable(string): void $onText
     */
    public function summarize(Discussion $discussion, User $actor, callable $onText): LlmResult
    {
        $posts = $this->posts($discussion, $actor);

        $result = $this->llm->make()->send(new LlmRequest(
            $this->settings->mainModel(),
            'Você resume discussões de fórum para quem vai ler a discussão. Escreva um resumo conciso e coerente das postagens que estão entre <input> e </input>: o assunto, os pontos principais, as conclusões ou soluções e o que ficou em aberto. Use Markdown com parágrafos curtos ou uma lista curta. Escreva no idioma principal da discussão. Não invente nada que não esteja nas postagens.',
            [['role' => 'user', 'content' => $this->content($discussion, $posts)]],
            [],
            16000,
            'medium',
        ), $onText);

        $summary = $this->find($discussion) ?? new TopicSummary();
        $summary->discussion_id = $discussion->id;
        $summary->summary = trim($result->text);
        $summary->summary_post_number = (int) $discussion->last_post_number;
        $summary->summary_post_count = (int) $discussion->comment_count;
        $summary->summary_model = $result->model;
        $summary->summary_updated_at = Carbon::now();
        $summary->save();

        return $result;
    }

    /**
     * O resumo curto da lista: uma frase, pelo modelo rápido, a partir do
     * começo do tópico e das últimas respostas.
     */
    public function gist(Discussion $discussion): ?string
    {
        $guest = new \Flarum\User\Guest();
        $posts = $this->posts($discussion, $guest, 3, 5);

        if ($posts->isEmpty()) {
            return null;
        }

        $result = $this->llm->make()->send(new LlmRequest(
            $this->settings->fastModel(),
            'Escreva uma única frase (no máximo 30 palavras) que resuma a discussão entre <input> e </input> para quem vê a lista de discussões: o que se discute e onde a conversa está. No idioma da discussão. Responda só com a frase.',
            [['role' => 'user', 'content' => $this->content($discussion, $posts)]],
            [],
            2048,
            'low',
        ));

        $gist = trim((string) preg_replace('/\s+/', ' ', $result->text));

        if ($gist === '') {
            return null;
        }

        $summary = $this->find($discussion) ?? new TopicSummary();
        $summary->discussion_id = $discussion->id;
        $summary->gist = mb_substr($gist, 0, 500);
        $summary->gist_post_number = (int) $discussion->last_post_number;
        $summary->gist_updated_at = Carbon::now();
        $summary->save();

        return $summary->gist;
    }

    /**
     * @return Collection<int, CommentPost>
     */
    private function posts(Discussion $discussion, User $actor, int $head = self::HEAD, int $tail = self::TAIL): Collection
    {
        $base = fn () => $discussion->comments()
            ->whereVisibleTo($actor)
            ->whereNull('hidden_at')
            ->where('is_private', false)
            ->with('user');

        $first = $base()->orderBy('number')->limit($head)->get();
        $last = $base()->orderByDesc('number')->limit($tail)->get();

        /** @var Collection<int, CommentPost> $posts */
        $posts = $first->merge($last)->unique('id')->sortBy('number')->values();

        return $posts;
    }

    /**
     * @param Collection<int, CommentPost> $posts
     */
    private function content(Discussion $discussion, Collection $posts): string
    {
        $parts = ['O título da discussão é: '.$discussion->title.'.'];

        $tags = isset($discussion->tags) ? collect($discussion->tags)->pluck('name')->filter()->implode(', ') : '';

        if ($tags !== '') {
            $parts[] = 'Tags: '.$tags.'.';
        }

        $input = '';
        $previous = 0;

        foreach ($posts as $post) {
            if ($previous && $post->number > $previous + 1) {
                $input .= "\n[… postagens do meio omitidas …]\n";
            }

            $entry = sprintf("(%d %s disse: %s)\n", $post->number, $post->user?->display_name ?? '[excluído]', PostText::plain((string) $post->content));

            if (mb_strlen($input) + mb_strlen($entry) > self::MAX_CHARS) {
                $input .= "\n[… cortado …]\n";
                break;
            }

            $input .= $entry;
            $previous = (int) $post->number;
        }

        $parts[] = "Aqui estão as postagens, entre as tags <input></input>:\n\n<input>\n".$input.'</input>';

        return implode("\n", $parts);
    }
}
