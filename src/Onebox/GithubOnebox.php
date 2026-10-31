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

namespace Ramon\Canela\Onebox;

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Os dados do cartão de um endereço do GitHub, como o onebox do Discourse:
 *
 * - arquivo: o repositório, o caminho, a ref e as linhas pedidas (`#L10-L20`),
 *   numeradas; sem linhas no endereço, as primeiras do arquivo;
 * - issue e pull request: título, estado, autor, data, rótulos, um trecho do
 *   texto e, no PR, os números do diff;
 * - commit: a mensagem, o autor, a data e os números do diff;
 * - release: o nome, a tag, se é pré-release, o autor, a data, um trecho das
 *   notas e quantos arquivos ela traz;
 * - repositório: a descrição, as estrelas, os forks e a linguagem.
 *
 * Só texto sai daqui (o fórum desenha o cartão com textContent), e só de
 * repositórios públicos: com o token do admin, o repositório é conferido
 * antes, para um token com acesso a repositórios privados não mostrar código
 * privado a quem escreveu o link. O resultado (inclusive "não achei") fica em
 * cache: um tópico lido mil vezes pede ao GitHub uma vez.
 */
final class GithubOnebox
{
    /** Linhas de um trecho, no máximo. */
    public const MAX_LINES = 50;

    /** Sem linhas no endereço, quantas do começo do arquivo. */
    public const DEFAULT_LINES = 10;

    /** Com uma linha só (`#L42`), quantas antes e depois dela. */
    public const CONTEXT = 3;

    private const MAX_LINE_CHARS = 300;

    private const MAX_FILE_BYTES = 1024 * 1024;

    private const MAX_API_BYTES = 512 * 1024;

    private const EXCERPT = 300;

    /** Um arquivo numa ref que é um sha não muda: fica uma semana. */
    private const TTL_PINNED = 7 * 86400;

    private const TTL = 6 * 3600;

    private const TTL_ERROR = 15 * 60;

    public function __construct(
        private readonly GithubHttp $http,
        private readonly OneboxSettings $settings,
        private readonly Cache $cache,
    ) {
    }

    /**
     * O cartão já em cache, sem pedir nada ao GitHub (null = não está).
     *
     * @return array<string, mixed>|null
     */
    public function cached(GithubUrl $url): ?array
    {
        $value = $this->cache->get($this->key($url));

        return is_array($value) ? $value : null;
    }

    /**
     * @return array<string, mixed> o cartão, ou `['error' => motivo]`
     */
    public function card(GithubUrl $url): array
    {
        if (($cached = $this->cached($url)) !== null) {
            return $cached;
        }

        $card = match ($url->type) {
            GithubUrl::FILE => $this->file($url),
            default => $this->api($url),
        };

        $ttl = isset($card['error']) ? self::TTL_ERROR
            : ($url->type === GithubUrl::FILE && preg_match('/^[0-9a-f]{40}$/i', $url->ref()) ? self::TTL_PINNED : self::TTL);
        $this->cache->put($this->key($url), $card, $ttl);

        return $card;
    }

    private function key(GithubUrl $url): string
    {
        return 'canela.onebox.github.'.sha1($url->canonical());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Arquivo
    // ─────────────────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function file(GithubUrl $url): array
    {
        // O raw não usa o token: só arquivos públicos, e não gasta a cota da API.
        $response = $this->http->get(
            'https://raw.githubusercontent.com/'.rawurlencode($url->owner).'/'.rawurlencode($url->repo).'/'.GithubUrl::encodePath($url->target),
            [],
            self::MAX_FILE_BYTES
        );

        if ($response['status'] !== 200) {
            return ['error' => $response['status'] === 413 ? 'too_large' : ($response['status'] === 404 ? 'not_found' : 'unavailable')];
        }

        $text = $response['body'];

        if (str_contains($text, "\0") || ! mb_check_encoding($text, 'UTF-8')) {
            return ['error' => 'binary'];
        }

        $all = preg_split('/\r\n|\r|\n/', rtrim($text, "\r\n")) ?: [];
        $total = count($all);

        [$from, $to, $highlight] = self::range($url->startLine, $url->endLine, $total);

        if ($from > $total) {
            return ['error' => 'not_found'];
        }

        $lines = [];

        for ($number = $from; $number <= $to; $number++) {
            $line = (string) $all[$number - 1];
            $lines[] = mb_strlen($line) > self::MAX_LINE_CHARS ? mb_substr($line, 0, self::MAX_LINE_CHARS).'…' : $line;
        }

        $path = $url->path();

        return [
            'type' => GithubUrl::FILE,
            'url' => $url->canonical(),
            'repo' => $url->repoName(),
            'path' => $path,
            'ref' => $url->ref(),
            'extension' => strtolower(pathinfo($path, PATHINFO_EXTENSION)),
            'firstLine' => $from,
            'lines' => $lines,
            'highlight' => $highlight,
            'totalLines' => $total,
        ];
    }

    /**
     * As linhas que o cartão mostra e as destacadas.
     *
     * @return array{0: int, 1: int, 2: array{0: int, 1: int}|null}
     */
    public static function range(?int $start, ?int $end, int $total): array
    {
        $total = max(1, $total);

        if ($start === null) {
            return [1, min($total, self::DEFAULT_LINES), null];
        }

        if ($end === null || $end === $start) {
            // Uma linha: ela, com um pouco de contexto.
            return [max(1, $start - self::CONTEXT), min($total, $start + self::CONTEXT), [$start, $start]];
        }

        // Um intervalo já é o trecho todo: sem destaque, como no Discourse.
        return [$start, min($total, $end, $start + self::MAX_LINES - 1), null];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API: repositório, issue, pull request, commit
    // ─────────────────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function api(GithubUrl $url): array
    {
        $base = 'https://api.github.com/repos/'.rawurlencode($url->owner).'/'.rawurlencode($url->repo);
        $repo = $this->json($base);

        if (isset($repo['error'])) {
            return $repo;
        }

        if (($repo['private'] ?? true) !== false) {
            return ['error' => 'not_found'];
        }

        $common = ['url' => $url->canonical(), 'repo' => (string) ($repo['full_name'] ?? $url->repoName())];

        if ($url->type === GithubUrl::REPO) {
            return $common + [
                'type' => GithubUrl::REPO,
                'description' => self::line((string) ($repo['description'] ?? ''), self::EXCERPT),
                'stars' => (int) ($repo['stargazers_count'] ?? 0),
                'forks' => (int) ($repo['forks_count'] ?? 0),
                'language' => self::line((string) ($repo['language'] ?? ''), 40),
                'updatedAt' => self::date($repo['pushed_at'] ?? null),
            ];
        }

        if ($url->type === GithubUrl::COMMIT) {
            $commit = $this->json($base.'/commits/'.$url->target);

            if (isset($commit['error'])) {
                return $commit;
            }

            $message = (string) ($commit['commit']['message'] ?? '');
            [$title, $body] = array_pad(explode("\n", $message, 2), 2, '');

            return $common + [
                'type' => GithubUrl::COMMIT,
                'sha' => (string) ($commit['sha'] ?? $url->target),
                'title' => self::line($title, 200),
                'excerpt' => self::excerpt($body),
                'author' => self::line((string) ($commit['author']['login'] ?? $commit['commit']['author']['name'] ?? ''), 60),
                'date' => self::date($commit['commit']['author']['date'] ?? null),
                'additions' => (int) ($commit['stats']['additions'] ?? 0),
                'deletions' => (int) ($commit['stats']['deletions'] ?? 0),
                'files' => is_array($commit['files'] ?? null) ? count($commit['files']) : 0,
            ];
        }

        if ($url->type === GithubUrl::RELEASE) {
            $release = $this->json($base.'/releases/'.($url->target === '' ? 'latest' : 'tags/'.GithubUrl::encodePath($url->target)));

            if (isset($release['error'])) {
                return $release;
            }

            $tag = self::line((string) ($release['tag_name'] ?? $url->target), 100);

            // "/releases/latest" muda com o tempo: o cartão aponta a release que mostrou.
            if ($url->target === '' && $tag !== '') {
                $common['url'] = 'https://github.com/'.rawurlencode($url->owner).'/'.rawurlencode($url->repo).'/releases/tag/'.GithubUrl::encodePath($tag);
            }

            return $common + [
                'type' => GithubUrl::RELEASE,
                'title' => self::line((string) ($release['name'] ?? '') ?: $tag, 200),
                'tag' => $tag,
                'state' => ($release['prerelease'] ?? false) ? 'prerelease' : 'release',
                'author' => self::line((string) ($release['author']['login'] ?? ''), 60),
                'date' => self::date($release['published_at'] ?? $release['created_at'] ?? null),
                'excerpt' => self::excerpt((string) ($release['body'] ?? '')),
                'assets' => is_array($release['assets'] ?? null) ? count($release['assets']) : 0,
            ];
        }

        // Issue e PR: o endpoint de issues serve aos dois; o de pulls traz o diff e o merge.
        $issue = $this->json($base.($url->type === GithubUrl::PULL ? '/pulls/' : '/issues/').$url->target);

        if (isset($issue['error'])) {
            return $issue;
        }

        // Uma issue que é PR (o endereço /issues/ de um PR): o GitHub redireciona; aqui vira PR.
        $isPull = $url->type === GithubUrl::PULL || isset($issue['pull_request']);
        $state = (string) ($issue['state'] ?? 'open');

        if ($isPull && ($issue['merged_at'] ?? null)) {
            $state = 'merged';
        } elseif ($isPull && ($issue['draft'] ?? false) && $state === 'open') {
            $state = 'draft';
        }

        $labels = [];

        foreach (array_slice(is_array($issue['labels'] ?? null) ? $issue['labels'] : [], 0, 5) as $label) {
            if (is_array($label) && is_string($label['name'] ?? null)) {
                $labels[] = self::line($label['name'], 40);
            }
        }

        $card = $common + [
            'type' => $isPull ? GithubUrl::PULL : GithubUrl::ISSUE,
            'number' => (int) ($issue['number'] ?? $url->target),
            'title' => self::line((string) ($issue['title'] ?? ''), 200),
            'state' => $state,
            'author' => self::line((string) ($issue['user']['login'] ?? ''), 60),
            'date' => self::date($issue['created_at'] ?? null),
            'comments' => (int) ($issue['comments'] ?? 0),
            'labels' => $labels,
            'excerpt' => self::excerpt((string) ($issue['body'] ?? '')),
        ];

        if ($url->type === GithubUrl::PULL) {
            $card += [
                'additions' => (int) ($issue['additions'] ?? 0),
                'deletions' => (int) ($issue['deletions'] ?? 0),
                'files' => (int) ($issue['changed_files'] ?? 0),
                'commits' => (int) ($issue['commits'] ?? 0),
            ];
        }

        return $card;
    }

    /** @return array<string, mixed> o JSON, ou `['error' => …]` */
    private function json(string $endpoint): array
    {
        $headers = ['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => '2022-11-28'];
        $token = $this->settings->githubToken();

        if ($token !== '') {
            $headers['Authorization'] = 'Bearer '.$token;
        }

        $response = $this->http->get($endpoint, $headers, self::MAX_API_BYTES);

        if ($response['status'] !== 200) {
            return ['error' => $response['status'] === 404 ? 'not_found' : 'unavailable'];
        }

        $data = json_decode($response['body'], true);

        return is_array($data) ? $data : ['error' => 'unavailable'];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Texto
    // ─────────────────────────────────────────────────────────────────────────

    /** Uma linha de texto: sem quebras nem controles, cortada em `$max`. */
    private static function line(string $text, int $max): string
    {
        $text = trim((string) preg_replace('/[\x00-\x1f\x7f\s]+/u', ' ', $text));

        return mb_strlen($text) > $max ? rtrim(mb_substr($text, 0, $max - 1)).'…' : $text;
    }

    /** Um trecho do Markdown do GitHub como texto corrido. */
    public static function excerpt(string $markdown): string
    {
        $text = (string) preg_replace('/```.*?(```|$)/s', ' ', $markdown);
        $text = (string) preg_replace('/<!--.*?-->/s', ' ', $text);
        $text = (string) preg_replace('/!\[[^\]]*\]\([^)]*\)/', ' ', $text);
        $text = (string) preg_replace('/\[([^\]]*)\]\([^)]*\)/', '$1', $text);
        $text = strip_tags($text);
        $text = (string) preg_replace('/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/m', '', $text);
        $text = str_replace(['**', '__', '`'], '', $text);

        return self::line(html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8'), self::EXCERPT);
    }

    private static function date(mixed $value): ?string
    {
        if (! is_string($value) || ($time = strtotime($value)) === false) {
            return null;
        }

        return gmdate('Y-m-d\TH:i:s\Z', $time);
    }
}
