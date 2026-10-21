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

namespace Ramon\Canela\Ai\Embeddings;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\User\Guest;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Llm\HttpTransport;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\TopicEmbedding;
use Ramon\Canela\Ai\Tools\PostText;

/**
 * Os "Tópicos relacionados" semânticos (por embeddings).
 *
 * - O vetor de cada tópico vem de uma API de embeddings compatível com a da
 *   OpenAI (`POST /embeddings`: OpenAI, Voyage, Mistral, Ollama…), a partir
 *   do título e do começo do primeiro post — o texto que diz do que o tópico
 *   trata.
 * - A semelhança é o cosseno, calculado em PHP sobre todos os vetores: para
 *   os poucos milhares de tópicos de um fórum Flarum é rápido, e o resultado
 *   fica em cache por uma hora.
 * - Só entram tópicos públicos (o vetor é feito como visitante), e a lista
 *   final ainda passa pela visibilidade de quem está vendo.
 */
final class RelatedTopics
{
    private const TEXT_CHARS = 6000;

    private const CANDIDATES = 20;

    public function __construct(
        private readonly AiSettings $settings,
        private readonly HttpTransport $http,
        private readonly Cache $cache,
    ) {
    }

    /**
     * @return list<int> ids dos tópicos relacionados que o ator pode ver
     */
    public function related(Discussion $discussion, User $actor, int $limit = 5): array
    {
        $candidates = $this->cache->remember('canela.ai.related.'.$discussion->id, 3600, function () use ($discussion): array {
            $vector = $this->vectorFor($discussion);

            return $vector === [] ? [] : $this->nearest($discussion->id, $vector);
        });

        if ($candidates === []) {
            return [];
        }

        $visible = Discussion::query()->whereVisibleTo($actor)->whereIn('id', $candidates)->pluck('id')->map(static fn ($id): int => (int) $id)->all();

        return array_slice(array_values(array_filter($candidates, static fn (int $id): bool => in_array($id, $visible, true))), 0, $limit);
    }

    /**
     * Gera ou atualiza o vetor de um tópico. Devolve false quando o tópico não
     * tem texto público ou já está em dia.
     *
     * @throws LlmException
     */
    public function embed(Discussion $discussion): bool
    {
        $text = $this->text($discussion);

        if ($text === '') {
            return false;
        }

        $digest = sha1($text);
        $model = $this->settings->string(AiSettings::EMBEDDINGS_MODEL);
        $existing = TopicEmbedding::query()->find($discussion->id);

        if ($existing && $existing->digest === $digest && $existing->model === $model) {
            return false;
        }

        $values = $this->request($text);

        $embedding = $existing ?? new TopicEmbedding();
        $embedding->discussion_id = $discussion->id;
        $embedding->model = $model;
        $embedding->digest = $digest;
        $embedding->vector = TopicEmbedding::pack($values);
        $embedding->updated_at = Carbon::now();
        $embedding->save();

        $this->cache->forget('canela.ai.related.'.$discussion->id);

        return true;
    }

    /**
     * O "Testar conexão" do admin: um vetor de uma palavra, devolvendo as
     * dimensões do modelo.
     *
     * @throws LlmException
     */
    public function probe(): int
    {
        return count($this->request('teste'));
    }

    /**
     * @return list<float>
     */
    private function vectorFor(Discussion $discussion): array
    {
        try {
            $this->embed($discussion);
        } catch (LlmException $error) {
            error_log('[ramon/canela] embeddings: '.$error->getMessage());
        }

        return TopicEmbedding::query()->find($discussion->id)?->values() ?? [];
    }

    /**
     * @param list<float> $vector
     *
     * @return list<int>
     */
    private function nearest(int $discussionId, array $vector): array
    {
        $model = $this->settings->string(AiSettings::EMBEDDINGS_MODEL);
        $norm = self::norm($vector);
        $scores = [];

        TopicEmbedding::query()
            ->where('model', $model)
            ->where('discussion_id', '!=', $discussionId)
            ->chunkById(500, function ($embeddings) use ($vector, $norm, &$scores): void {
                foreach ($embeddings as $embedding) {
                    $other = $embedding->values();

                    if (count($other) !== count($vector)) {
                        continue;
                    }

                    $dot = 0.0;

                    foreach ($vector as $i => $value) {
                        $dot += $value * $other[$i];
                    }

                    $scores[$embedding->discussion_id] = $dot / (($norm * self::norm($other)) ?: 1.0);
                }
            }, 'discussion_id');

        arsort($scores);

        return array_map('intval', array_slice(array_keys($scores), 0, self::CANDIDATES));
    }

    /**
     * @param list<float> $vector
     */
    private static function norm(array $vector): float
    {
        $sum = 0.0;

        foreach ($vector as $value) {
            $sum += $value * $value;
        }

        return sqrt($sum);
    }

    private function text(Discussion $discussion): string
    {
        $post = $discussion->comments()->whereVisibleTo(new Guest())->whereNull('hidden_at')->where('is_private', false)->orderBy('number')->first();

        if (! $post) {
            return '';
        }

        return mb_substr($discussion->title."\n\n".PostText::plain((string) $post->content), 0, self::TEXT_CHARS);
    }

    /**
     * @return list<float>
     *
     * @throws LlmException
     */
    private function request(string $text): array
    {
        $key = $this->settings->string(AiSettings::EMBEDDINGS_KEY);
        $response = $this->http->postJson(
            $this->settings->string(AiSettings::EMBEDDINGS_URL),
            $key !== '' ? ['Authorization' => 'Bearer '.$key] : [],
            ['model' => $this->settings->string(AiSettings::EMBEDDINGS_MODEL), 'input' => $text],
            null,
            60
        );

        $data = json_decode($response['body'], true);

        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw LlmException::fromStatus($response['status'], is_array($data) ? (string) ($data['error']['message'] ?? '') : '');
        }

        $values = is_array($data) ? ($data['data'][0]['embedding'] ?? null) : null;

        if (! is_array($values) || $values === []) {
            throw new LlmException('server', 'Resposta de embeddings sem vetor.');
        }

        return array_map('floatval', array_values($values));
    }
}
