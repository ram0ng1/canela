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
 * Busca em outras fontes (`search_external`): fóruns Flarum, pela API
 * pública de cada um (por padrão o discuss.flarum.org). Devolve título,
 * link de lá, data, respostas e o começo do primeiro post, para a IA pôr
 * os links na resposta.
 */
final class ExternalSearchTool implements AiTool
{
    public const NAME = 'search_external';

    private const LIMIT = 6;

    /**
     * @param list<string> $sources endereços https, sem a barra no fim
     */
    public function __construct(
        private readonly array $sources,
        private ?Client $client = null,
    ) {
    }

    #[\Override]
    public function definition(): ToolDefinition
    {
        $hosts = array_map(self::host(...), $this->sources);

        return new ToolDefinition(
            self::NAME,
            sprintf('Só para tópicos do assunto dessas fontes. Busca discussões em outras fontes (fóruns Flarum: %s) por palavras-chave, de preferência em inglês. Sem "source", busca em todas. Devolve título, link, data, respostas e o começo do primeiro post; para ler as respostas, use read_external com o link.', implode(', ', $hosts)),
            [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'description' => 'Palavras-chave da busca.'],
                    'source' => ['type' => 'string', 'enum' => $hosts, 'description' => 'Só esta fonte (opcional).'],
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

        $sources = array_values(array_filter($this->sources, static fn (string $url) => ! isset($input['source']) || self::host($url) === $input['source'])) ?: $this->sources;
        $limit = max(2, intdiv(self::LIMIT * 2, count($sources) + 1));
        $blocks = [];

        foreach ($sources as $source) {
            $lines = $this->search($source, $query, $limit, $activity);
            $blocks[] = sprintf("Em %s:\n%s", self::host($source), $lines === [] ? '- nada encontrado' : implode("\n", $lines));
        }

        return new ToolOutput(sprintf("Resultados para \"%s\":\n%s", $query, implode("\n\n", $blocks)), $activity);
    }

    /**
     * @param array{results: list<array<string, string>>} $activity
     * @return list<string>
     */
    private function search(string $source, string $query, int $limit, array &$activity): array
    {
        try {
            $response = ($this->client ??= new Client())->get($source.'/api/discussions', [
                'query' => [
                    'filter' => ['q' => $query],
                    'page' => ['limit' => $limit],
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
            return [sprintf('- a busca falhou (%s)', $error->getMessage())];
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
            $url = $source.'/d/'.rawurlencode((string) ($attributes['slug'] ?? $discussion['id'] ?? ''));
            $html = $posts[(string) ($discussion['relationships']['firstPost']['data']['id'] ?? '')] ?? '';
            $excerpt = mb_substr(trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string) preg_replace('#<(script|style)\b.*?</\1>#is', '', $html)), ENT_QUOTES | ENT_HTML5))), 0, 300);

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

        return $lines;
    }

    private static function host(string $url): string
    {
        return (string) parse_url($url, PHP_URL_HOST);
    }
}
