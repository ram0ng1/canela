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

use Flarum\Discussion\Discussion;
use Flarum\Search\SearchCriteria;
use Flarum\Search\SearchManager;
use Flarum\User\User;
use Ramon\Canela\Ai\Llm\ToolDefinition;

/**
 * A busca do fórum para o bot (`search_forum`), a ferramenta "Pesquisar" das
 * personas.
 *
 * Usa a mesma busca do Flarum, com o ator de quem conversa: as permissões de
 * tags, de aprovação e de tópicos ocultos valem como na busca do cabeçalho.
 * Devolve título, endereço, data, respostas e o começo do primeiro post — o
 * suficiente para o modelo decidir o que ler com `read_topic`.
 */
final class ForumSearchTool implements AiTool
{
    public const NAME = 'search_forum';

    private const LIMIT = 8;

    public function __construct(
        private readonly SearchManager $search,
        private readonly TopicLinks $links,
    ) {
    }

    #[\Override]
    public function definition(): ToolDefinition
    {
        return new ToolDefinition(
            self::NAME,
            'Busca discussões neste fórum por palavras-chave (busca de texto completo, como a caixa de busca do fórum). Use termos curtos e específicos; faça mais de uma busca se a primeira não trouxer o que precisa. Devolve até 8 discussões com id, título, endereço, data, número de respostas e um trecho.',
            [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'description' => 'Palavras-chave da busca.'],
                ],
                'required' => ['query'],
                'additionalProperties' => false,
            ]
        );
    }

    #[\Override]
    public function run(array $input, User $actor): ToolOutput
    {
        $query = trim(mb_substr((string) ($input['query'] ?? ''), 0, 200));

        if ($query === '') {
            return new ToolOutput('Erro: a busca precisa de palavras-chave.', ['tool' => self::NAME, 'query' => '', 'results' => []], true);
        }

        $results = $this->search->query(Discussion::class, new SearchCriteria($actor, ['q' => $query], self::LIMIT))->getResults();
        $results->loadMissing('firstPost');

        $items = [];
        $lines = [];

        foreach ($results as $discussion) {
            if (! $discussion instanceof Discussion) {
                continue;
            }

            $url = $this->links->discussion($discussion);
            $excerpt = PostText::excerpt((string) ($discussion->firstPost?->content ?? ''), 300);

            $items[] = ['id' => (string) $discussion->id, 'title' => $discussion->title, 'url' => $url];
            $lines[] = sprintf(
                "- id %d: \"%s\" (%s) — %s, %d resposta(s)\n  %s",
                $discussion->id,
                $discussion->title,
                $url,
                $discussion->created_at?->toDateString() ?? '',
                max(0, (int) $discussion->comment_count - 1),
                $excerpt
            );
        }

        $content = $lines === []
            ? sprintf('Nenhuma discussão encontrada para "%s".', $query)
            : sprintf("Resultados para \"%s\":\n%s", $query, implode("\n", $lines));

        return new ToolOutput($content, ['tool' => self::NAME, 'query' => $query, 'results' => $items]);
    }
}
