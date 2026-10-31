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

/**
 * Um endereço do GitHub que vira cartão (onebox), já conferido pedaço por
 * pedaço. Só os formatos abaixo entram; qualquer outro devolve null, e o
 * servidor nunca busca um endereço montado com texto de quem escreveu:
 * monta o seu, com os pedaços validados, em hosts fixos.
 *
 * - arquivo: `github.com/{dono}/{repo}/blob/{ref}/{caminho}#L10-L20`
 * - issue e pull request: `github.com/{dono}/{repo}/issues/{n}` e `/pull/{n}`
 * - commit: `github.com/{dono}/{repo}/commit/{sha}`
 * - release: `github.com/{dono}/{repo}/releases/tag/{tag}` e `/releases/latest`
 * - repositório: `github.com/{dono}/{repo}`
 */
final class GithubUrl
{
    public const FILE = 'file';

    public const ISSUE = 'issue';

    public const PULL = 'pull';

    public const COMMIT = 'commit';

    public const REPO = 'repo';

    public const RELEASE = 'release';

    /** Nomes que o GitHub usa no lugar de um dono (páginas do site, não repositórios). */
    private const RESERVED = ['about', 'apps', 'blog', 'collections', 'contact', 'enterprise', 'explore', 'features', 'login', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing', 'pulls', 'issues', 'search', 'settings', 'sponsors', 'topics', 'trending', 'users', 'codespaces', 'site', 'security', 'join'];

    private function __construct(
        public readonly string $type,
        public readonly string $owner,
        public readonly string $repo,
        /** O número da issue ou do PR, o sha do commit, a tag da release ('' = a mais recente) ou "{ref}/{caminho}" do arquivo. */
        public readonly string $target = '',
        public readonly ?int $startLine = null,
        public readonly ?int $endLine = null,
    ) {
    }

    public static function parse(string $url): ?self
    {
        $url = trim($url);

        if (strlen($url) > 500) {
            return null;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || ! in_array(strtolower($parts['host'] ?? ''), ['github.com', 'www.github.com'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            return null;
        }

        $segments = array_values(array_filter(explode('/', (string) ($parts['path'] ?? '')), static fn (string $segment): bool => $segment !== ''));
        $segments = array_map('rawurldecode', $segments);

        if (count($segments) < 2 || ! self::validName($segments[0], 39) || ! self::validName($segments[1], 100)
            || in_array(strtolower($segments[0]), self::RESERVED, true)) {
            return null;
        }

        [$owner, $repo] = [$segments[0], preg_replace('/\.git$/', '', $segments[1]) ?? $segments[1]];
        $rest = array_slice($segments, 2);

        if ($rest === []) {
            return new self(self::REPO, $owner, $repo);
        }

        $kind = $rest[0];

        if (($kind === 'issues' || $kind === 'pull') && count($rest) >= 2 && preg_match('/^[1-9]\d{0,9}$/', $rest[1])) {
            return new self($kind === 'issues' ? self::ISSUE : self::PULL, $owner, $repo, $rest[1]);
        }

        if ($kind === 'commit' && count($rest) === 2 && preg_match('/^[0-9a-f]{7,40}$/i', $rest[1])) {
            return new self(self::COMMIT, $owner, $repo, strtolower($rest[1]));
        }

        if ($kind === 'releases' && count($rest) === 2 && $rest[1] === 'latest') {
            return new self(self::RELEASE, $owner, $repo);
        }

        if ($kind === 'releases' && count($rest) >= 3 && $rest[1] === 'tag') {
            $tag = implode('/', array_slice($rest, 2));

            // Os caracteres de um nome de tag do git, sem "..".
            if (strlen($tag) > 255 || ! preg_match('/^[A-Za-z0-9][A-Za-z0-9._+\/-]*$/', $tag) || str_contains($tag, '..')) {
                return null;
            }

            return new self(self::RELEASE, $owner, $repo, $tag);
        }

        if ($kind === 'blob' && count($rest) >= 3) {
            $path = array_slice($rest, 1);

            foreach ($path as $segment) {
                // Nada de "..", nem caracteres de controle: o caminho vai para outra URL.
                if ($segment === '.' || $segment === '..' || preg_match('/[\x00-\x1f\x7f\\\\]/', $segment) || strlen($segment) > 255) {
                    return null;
                }
            }

            [$start, $end] = self::lines((string) ($parts['fragment'] ?? ''));

            return new self(self::FILE, $owner, $repo, implode('/', $path), $start, $end);
        }

        return null;
    }

    /**
     * "L10", "L10-L20" (ou "L10-20"); a ordem invertida é aceita.
     *
     * @return array{0: int|null, 1: int|null}
     */
    private static function lines(string $fragment): array
    {
        if (! preg_match('/^L(\d{1,7})(?:-L?(\d{1,7}))?$/', $fragment, $match)) {
            return [null, null];
        }

        $start = max(1, (int) $match[1]);
        $end = isset($match[2]) ? max(1, (int) $match[2]) : $start;

        return $start <= $end ? [$start, $end] : [$end, $start];
    }

    private static function validName(string $name, int $max): bool
    {
        return strlen($name) <= $max && (bool) preg_match('/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_])?$/', $name) && ! str_contains($name, '..');
    }

    public function repoName(): string
    {
        return $this->owner.'/'.$this->repo;
    }

    /** A primeira parte do "{ref}/{caminho}": o nome curto que o cartão mostra. */
    public function ref(): string
    {
        return $this->type === self::FILE ? explode('/', $this->target, 2)[0] : '';
    }

    /** O caminho do arquivo, sem a ref. */
    public function path(): string
    {
        return $this->type === self::FILE ? (explode('/', $this->target, 2)[1] ?? '') : '';
    }

    /** O endereço canônico (a chave do cache e o link do cartão). */
    public function canonical(): string
    {
        $base = 'https://github.com/'.rawurlencode($this->owner).'/'.rawurlencode($this->repo);

        return match ($this->type) {
            self::REPO => $base,
            self::ISSUE => $base.'/issues/'.$this->target,
            self::PULL => $base.'/pull/'.$this->target,
            self::COMMIT => $base.'/commit/'.$this->target,
            self::RELEASE => $base.'/releases/'.($this->target === '' ? 'latest' : 'tag/'.self::encodePath($this->target)),
            default => $base.'/blob/'.self::encodePath($this->target).($this->startLine ? '#L'.$this->startLine.($this->endLine !== $this->startLine ? '-L'.$this->endLine : '') : ''),
        };
    }

    public static function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }
}
