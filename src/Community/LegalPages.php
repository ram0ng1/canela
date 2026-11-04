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

namespace Ramon\Canela\Community;

use Flarum\Extension\ExtensionManager;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use FoF\Pages\Page;
use Ramon\Canela\Support\Log;
use Throwable;

/**
 * As abas "Termos de Serviço" e "Política de Privacidade" do Sobre (as rotas
 * /tos e /privacy), e as outras políticas do fof/terms.
 *
 * As políticas do fof/terms vêm primeiro — são as que o cadastro pede para
 * aceitar, e o link precisa ser o mesmo. Elas têm só nome e endereço, então o
 * tema reconhece qual é qual pelo nome ("Termos de uso", "Privacidade"…); as
 * que não se encaixam viram abas com o próprio nome. Sem política, valem os
 * endereços do admin do tema. Sem endereço, a aba não aparece.
 *
 * Quando o endereço é uma página do fof/pages deste fórum (`/p/{id}-…`), a
 * entrada leva o `pageId` e o `slug` dela: a aba abre a página dentro da
 * área Sobre (/about/{id}-{slug}), com as mesmas abas e o layout das
 * Diretrizes, em vez de levar ao layout do fof/pages.
 */
final class LegalPages
{
    private const TOS_PATTERN = '/termo|terms|\btos\b|servi[cç]o|condi[cç]/iu';

    private const PRIVACY_PATTERN = '/privac|privad|lgpd|gdpr|dados pessoais|personal data/iu';

    /** @var list<array{key: string, title: string|null, url: string, pageId?: int, slug?: string}>|null */
    private ?array $memo = null;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
        private readonly UrlGenerator $url,
    ) {
    }

    /**
     * `key` é "tos", "privacy" ou "policy-<id>"; `title` vem só nas políticas
     * extras (as duas fixas usam a tradução do fórum). `pageId` e `slug` só
     * quando o endereço é uma página do fof/pages que existe.
     *
     * @return list<array{key: string, title: string|null, url: string, pageId?: int, slug?: string}>
     */
    public function all(): array
    {
        if ($this->memo !== null) {
            return $this->memo;
        }

        $pages = ['tos' => null, 'privacy' => null];
        $extra = [];

        foreach ($this->policies() as $policy) {
            $url = trim((string) $policy->url);
            $name = (string) $policy->name;

            if (! $this->isUrl($url)) {
                continue;
            }

            if ($pages['privacy'] === null && preg_match(self::PRIVACY_PATTERN, $name) === 1) {
                $pages['privacy'] = ['key' => 'privacy', 'title' => null, 'url' => $url];
            } elseif ($pages['tos'] === null && preg_match(self::TOS_PATTERN, $name) === 1) {
                $pages['tos'] = ['key' => 'tos', 'title' => null, 'url' => $url];
            } else {
                $extra[] = ['key' => 'policy-'.$policy->id, 'title' => $name, 'url' => $url];
            }
        }

        foreach (['tos' => Community::TOS_URL, 'privacy' => Community::PRIVACY_URL] as $key => $setting) {
            $url = trim((string) $this->settings->get($setting));

            if ($pages[$key] === null && $this->isUrl($url)) {
                $pages[$key] = ['key' => $key, 'title' => null, 'url' => $url];
            }
        }

        return $this->memo = $this->withPages([...array_values(array_filter($pages)), ...$extra]);
    }

    /**
     * Os ids das páginas do fof/pages que são políticas: a área Sobre também
     * as abre (AboutPages::find).
     *
     * @return list<int>
     */
    public function pageIds(): array
    {
        return array_values(array_filter(array_map(static fn (array $page): int => $page['pageId'] ?? 0, $this->all())));
    }

    /**
     * Marca as políticas que são páginas do fof/pages com o id e o slug (uma
     * consulta para todas).
     *
     * @param list<array{key: string, title: string|null, url: string}> $pages
     *
     * @return list<array{key: string, title: string|null, url: string, pageId?: int, slug?: string}>
     */
    private function withPages(array $pages): array
    {
        if (! $this->extensions->isEnabled('fof-pages') || ! class_exists(Page::class)) {
            return $pages;
        }

        $refs = [];

        foreach ($pages as $index => $page) {
            $ref = $this->localPage($page['url']);

            if ($ref !== null) {
                $refs[$index] = $ref;
            }
        }

        if ($refs === []) {
            return $pages;
        }

        $ids = array_values(array_filter($refs, 'is_int'));
        $slugs = array_values(array_filter($refs, 'is_string'));

        try {
            $found = Page::query()
                ->where(static function ($query) use ($ids, $slugs): void {
                    $query->whereIn('id', $ids ?: [0])->orWhereIn('slug', $slugs ?: ['']);
                })
                ->get(['id', 'slug']);
        } catch (Throwable $error) {
            Log::warning('páginas do fof/pages nas políticas: '.$error->getMessage());

            return $pages;
        }

        foreach ($refs as $index => $ref) {
            $match = $found->first(static fn (Page $page): bool => is_int($ref) ? (int) $page->id === $ref : (string) $page->slug === $ref);

            if ($match instanceof Page) {
                $pages[$index]['pageId'] = (int) $match->id;
                $pages[$index]['slug'] = trim((string) preg_replace('/[^\pL\pN_-]+/u', '-', (string) $match->slug), '-');
            }
        }

        return $pages;
    }

    /**
     * A página do fof/pages deste fórum que o endereço abre: o id
     * (`/p/3-termos`, `/p/3`) ou o slug (`/p/termos`), relativo ou completo,
     * com ou sem `www`. null para qualquer outro endereço.
     */
    private function localPage(string $url): int|string|null
    {
        $base = $this->url->to('forum')->base();
        $basePath = rtrim((string) parse_url($base, PHP_URL_PATH), '/');
        $host = parse_url($url, PHP_URL_HOST);
        $bare = static fn (string $name): string => (string) preg_replace('/^www\./i', '', strtolower($name));

        if (is_string($host) && $bare($host) !== $bare((string) parse_url($base, PHP_URL_HOST))) {
            return null;
        }

        $path = rawurldecode((string) parse_url($url, PHP_URL_PATH));

        if ($basePath !== '' && str_starts_with($path, $basePath.'/')) {
            $path = substr($path, strlen($basePath));
        }

        if (preg_match('#^/p/(\d+)(?:-[^/]*)?/?$#', $path, $match) === 1) {
            return (int) $match[1];
        }

        return preg_match('#^/p/([^/]+)/?$#', $path, $match) === 1 ? $match[1] : null;
    }

    /** @return iterable<object> */
    private function policies(): iterable
    {
        $repository = 'FoF\\Terms\\Repositories\\PolicyRepository';

        if (! $this->extensions->isEnabled('fof-terms') || ! class_exists($repository)) {
            return [];
        }

        try {
            // O repositório do fof/terms guarda as políticas em cache para sempre
            // (e limpa ao salvar): não custa uma consulta por página.
            return resolve($repository)->all();
        } catch (Throwable $error) {
            Log::warning('políticas do fof/terms: '.$error->getMessage());

            return [];
        }
    }

    /** Endereço completo (https://…) ou caminho do próprio fórum (/termos). */
    private function isUrl(string $url): bool
    {
        return $url !== '' && preg_match('#^(https?://[^\s]+|/[^\s/][^\s]*)$#i', $url) === 1;
    }
}
