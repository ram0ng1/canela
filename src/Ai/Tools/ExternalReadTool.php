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
use Throwable;

/**
 * Lê uma discussão de outra fonte (`read_external`): as postagens dela, pela
 * API pública do fórum Flarum, para a IA saber o que foi respondido em vez
 * de só ter o link e o começo do primeiro post. Só links das fontes
 * registradas.
 */
final class ExternalReadTool implements AiTool
{
    public const NAME = 'read_external';

    private const POSTS = 20;

    private const POST_LENGTH = 1500;

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
        return new ToolDefinition(
            self::NAME,
            sprintf('Lê uma discussão das outras fontes (%s) pelo link dela (o que a search_external devolve): as primeiras %d postagens, com autor e texto. Use para saber o que foi respondido antes de citar a discussão.', implode(', ', array_map(static fn (string $url) => (string) parse_url($url, PHP_URL_HOST), $this->sources)), self::POSTS),
            [
                'type' => 'object',
                'properties' => [
                    'url' => ['type' => 'string', 'description' => 'O link da discussão (…/d/123-titulo).'],
                ],
                'required' => ['url'],
                'additionalProperties' => false,
            ]
        );
    }

    #[\Override]
    public function run(array $input, User $actor): ToolOutput
    {
        $url = trim((string) ($input['url'] ?? ''));
        $activity = ['tool' => self::NAME, 'url' => $url];
        $source = null;

        foreach ($this->sources as $candidate) {
            if (preg_match('#^'.preg_quote($candidate, '#').'/d/(\d+)#', $url, $match)) {
                [$source, $id] = [$candidate, $match[1]];
                break;
            }
        }

        if ($source === null) {
            return new ToolOutput('Erro: o link não é de uma discussão das outras fontes registradas.', $activity, true);
        }

        try {
            $response = ($this->client ??= new Client())->get($source.'/api/posts', [
                'query' => [
                    'filter' => ['discussion' => $id, 'type' => 'comment'],
                    'sort' => 'number',
                    'page' => ['limit' => self::POSTS],
                    'include' => 'user',
                    'fields' => ['posts' => 'number,contentHtml,createdAt,user', 'users' => 'displayName'],
                ],
                'headers' => ['Accept' => 'application/vnd.api+json', 'User-Agent' => 'ramon-canela-assistant'],
                'allow_redirects' => false,
                'connect_timeout' => 5,
                'timeout' => 15,
            ]);
            $json = json_decode((string) $response->getBody(), true, 64, JSON_THROW_ON_ERROR);
        } catch (Throwable $error) {
            return new ToolOutput(sprintf('Erro: não deu para ler a discussão (%s).', $error->getMessage()), $activity, true);
        }

        $users = [];

        foreach ((array) ($json['included'] ?? []) as $item) {
            if (($item['type'] ?? null) === 'users') {
                $users[(string) $item['id']] = (string) ($item['attributes']['displayName'] ?? '');
            }
        }

        $lines = [];

        foreach ((array) ($json['data'] ?? []) as $post) {
            $attributes = (array) ($post['attributes'] ?? []);
            $html = (string) preg_replace('#<(script|style)\b.*?</\1>#is', '', (string) ($attributes['contentHtml'] ?? ''));
            $text = trim((string) preg_replace('/[ \t]+/u', ' ', html_entity_decode(strip_tags((string) preg_replace('#</(p|li|pre|blockquote|h\d)>|<br\s*/?>#i', "\n", $html)), ENT_QUOTES | ENT_HTML5)));
            $text = (string) preg_replace('/\n{3,}/', "\n\n", $text);

            $lines[] = sprintf(
                "#%d · %s · %s\n%s",
                (int) ($attributes['number'] ?? 0),
                $users[(string) ($post['relationships']['user']['data']['id'] ?? '')] ?? '?',
                substr((string) ($attributes['createdAt'] ?? ''), 0, 10),
                mb_strlen($text) > self::POST_LENGTH ? mb_substr($text, 0, self::POST_LENGTH).'…' : $text
            );
        }

        return $lines === []
            ? new ToolOutput('A discussão não tem postagens visíveis.', $activity, true)
            : new ToolOutput(sprintf("Discussão %s:\n\n%s", $url, implode("\n\n", $lines)), $activity);
    }
}
