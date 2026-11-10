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

use Flarum\User\User;
use GuzzleHttp\Client;
use Ramon\Canela\Ai\Llm\ToolDefinition;
use Ramon\Canela\Support\Dates;
use Throwable;

/**
 * Busca em outro fórum Flarum (`search_external`), pela API pública dele:
 * por padrão o discuss.flarum.org. Devolve título, link de lá, data,
 * respostas e o começo do primeiro post, para a IA citar os links.
 */
final class ExternalForumSearchTool implements AiTool
{
    public const NAME = 'search_external';

    private const LIMIT = 6;

    public function __construct(
        private readonly string $baseUrl,
        private ?Client $client = null,
    ) {
    }

    #[\Override]
    public function definition(): ToolDefinition
    {
        return new ToolDefinition(
            self::NAME,
            sprintf('Busca discussões em %s (outro fórum Flarum) por palavras-chave, de preferência em inglês. Devolve até %d discussões com título, link, data, respostas e um trecho; ponha na resposta os links que ajudarem.', $this->host(), self::LIMIT),
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
        $activity = ['tool' => self::NAME, 'query' => $query, 'results' => []];

        if ($query === '') {
            return new ToolOutput('Erro: a busca precisa de palavras-chave.', $activity, true);
        }

        try {
            $response = ($this->client ??= new Client())->get($this->baseUrl.'/api/discussions', [
                'query' => [
                    'filter' => ['q' => $query],
                    'page' => ['limit' => self::LIMIT],
                    'include' => 'firstPost',
                    'fields' => ['discussions' => 'title,slug,commentCount,createdAt,firstPost', 'posts' => 'contentHtml'],
                ],
                'headers' => ['Accept' => 'application/vnd.api+json', 'User-Agent' => 'ramon-canela-assistant'],
                'allow_redirects' => false,
                'connect_timeout' => 5,
                'timeout' => 10,
            ]);
            $json = json_decode((string) $response->getBody(), true, 64, JSON_THROW_ON_ERROR);
        } catch (Throwable $error) {
            return new ToolOutput(sprintf('Erro: a busca em %s falhou (%s).', $this->host(), $error->getMessage()), $activity, true);
        }

        $posts = [];

        foreach ((array) ($json['included'] ?? []) as $item) {
            if (($item['type'] ?? null) === 'posts') {
                $posts[(string) $item['id']] = (string) ($item['attributes']['contentHtml'] ?? '');
            }
        }

        $lines = [];

        foreach ((array) ($json['data'] ?? []) as $discussion) {
            $attributes = (array) ($discussion['attributes'] ?? []);
            $url = $this->baseUrl.'/d/'.rawurlencode((string) ($attributes['slug'] ?? $discussion['id'] ?? ''));
            $html = $posts[(string) ($discussion['relationships']['firstPost']['data']['id'] ?? '')] ?? '';
            $excerpt = mb_substr(trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5))), 0, 300);

            $activity['results'][] = ['id' => (string) ($discussion['id'] ?? ''), 'title' => (string) ($attributes['title'] ?? ''), 'url' => $url];
            $lines[] = sprintf(
                "- \"%s\" (%s) — %s, %d resposta(s)\n  %s",
                $attributes['title'] ?? '',
                $url,
                isset($attributes['createdAt']) ? Dates::day(new \DateTimeImmutable((string) $attributes['createdAt'])) : '?',
                max(0, (int) ($attributes['commentCount'] ?? 1) - 1),
                $excerpt
            );
        }

        $content = $lines === []
            ? sprintf('Nada encontrado em %s para "%s".', $this->host(), $query)
            : sprintf("Resultados em %s para \"%s\":\n%s", $this->host(), $query, implode("\n", $lines));

        return new ToolOutput($content, $activity);
    }

    private function host(): string
    {
        return (string) parse_url($this->baseUrl, PHP_URL_HOST);
    }
}
