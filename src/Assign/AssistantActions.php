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

namespace Ramon\Canela\Assign;

use Flarum\Discussion\Discussion;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Ramon\Canela\Ai\Llm\LlmClient;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Throwable;

/**
 * Curtir, título e tags: decididos numa chamada só deles, depois da
 * resposta e com ela à vista, e devolvidos em JSON. Pedidos no meio da
 * resposta (ferramenta ou linhas no fim), os modelos os esqueciam ou os
 * escreviam como texto ("o melhor é mover para Off-topic").
 */
final class AssistantActions
{
    /**
     * @return array{like: list<int>, title: string, tags: list<string>, inputTokens: int, outputTokens: int}
     */
    public function decide(LlmClient $client, string $model, AssistantBot $bot, Discussion $discussion, User $assistant, string $transcript, string $reply): array
    {
        $none = ['like' => [], 'title' => '', 'tags' => [], 'inputTokens' => 0, 'outputTokens' => 0];
        $fields = array_filter([
            $bot->can('like') ? '"like": os números (#N) das postagens a curtir, como alguém da comunidade curtiria: a pergunta que você respondeu, se for boa, e as que ajudaram (uma solução que funcionou, uma boa explicação, um agradecimento, alguém dizendo que resolveu). Nunca as suas. [] se nenhuma.' : null,
            $bot->can('rename') ? '"title": um título novo se o atual não descreve bem o assunto ou foge do padrão do fórum (curto, direto, no idioma do tópico, sem "ajuda" nem "urgente"); "" para manter.' : null,
            $bot->can('retag') ? '"tags": os slugs das tags certas se as atuais não combinam com o assunto (o assunto manda, não o que a pessoa escolheu); [] para manter. '.$this->tags($discussion, $assistant) : null,
        ]);

        if ($fields === []) {
            return $none;
        }

        $system = implode("\n", array_filter([
            'Você é o assistente de um fórum e acabou de responder no tópico abaixo. Agora decida as ações sobre o tópico, como alguém da equipe.',
            'Responda só com um objeto JSON, sem texto antes ou depois, com estes campos:',
            ...array_map(static fn (string $field) => '- '.$field, $fields),
            'Se a sua resposta disse que ia mudar o título ou as tags, faça exatamente o que ela disse.',
            $bot->instructions() !== '' ? 'Instruções do fórum (valem para as ações também): '.$bot->instructions() : null,
        ]));

        try {
            $result = $client->send(new LlmRequest($model, $system, [['role' => 'user', 'content' => $transcript."\n\nSua resposta, já publicada:\n".$reply]], [], 1024, 'low'));
        } catch (Throwable) {
            return $none;
        }

        $json = preg_match('/\{.*\}/s', $result->text, $match) ? json_decode($match[0], true) : null;
        $json = is_array($json) ? $json : [];

        return [
            'like' => array_values(array_unique(array_filter(array_map(static fn ($n) => (int) ltrim((string) $n, '#'), (array) ($json['like'] ?? []))))),
            'title' => is_string($json['title'] ?? null) ? trim($json['title']) : '',
            'tags' => array_values(array_filter(array_map(static fn ($slug) => trim((string) $slug, " \t#\"'`"), (array) ($json['tags'] ?? [])))),
            'inputTokens' => $result->inputTokens,
            'outputTokens' => $result->outputTokens,
        ];
    }

    /** As tags que o assistente vê (pelo slug, com a mãe das filhas) e as atuais. */
    private function tags(Discussion $discussion, User $assistant): string
    {
        $all = Tag::query()->whereVisibleTo($assistant)->orderBy('position')->limit(80)->get();
        $byId = $all->keyBy('id');
        $name = static fn (Tag $tag): string => sprintf(
            '%s%s (%s%s)',
            ($parent = $byId->get((int) $tag->parent_id)) instanceof Tag ? $parent->name.' › ' : '',
            $tag->name,
            $tag->slug,
            $tag->position === null ? ', secundária' : ''
        );

        return sprintf(
            'Tags do fórum: %s. Tags atuais: %s. Uma tag filha (Mãe › Filha) já leva a mãe junto.',
            $all->map($name)->implode('; '),
            $discussion->tags()->get()->map($name)->implode('; ') ?: 'nenhuma'
        );
    }
}
