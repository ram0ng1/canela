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
use Flarum\Settings\SettingsRepositoryInterface;
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
 */
final class LegalPages
{
    private const TOS_PATTERN = '/termo|terms|\btos\b|servi[cç]o|condi[cç]/iu';

    private const PRIVACY_PATTERN = '/privac|privad|lgpd|gdpr|dados pessoais|personal data/iu';

    /** @var list<array{key: string, title: string|null, url: string}>|null */
    private ?array $memo = null;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    /**
     * `key` é "tos", "privacy" ou "policy-<id>"; `title` vem só nas políticas
     * extras (as duas fixas usam a tradução do fórum).
     *
     * @return list<array{key: string, title: string|null, url: string}>
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

        return $this->memo = [...array_values(array_filter($pages)), ...$extra];
    }

    public function url(string $key): ?string
    {
        foreach ($this->all() as $page) {
            if ($page['key'] === $key) {
                return $page['url'];
            }
        }

        return null;
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
            error_log('[ramon/canela] políticas do fof/terms: '.$error->getMessage());

            return [];
        }
    }

    /** Endereço completo (https://…) ou caminho do próprio fórum (/termos). */
    private function isUrl(string $url): bool
    {
        return $url !== '' && preg_match('#^(https?://[^\s]+|/[^\s/][^\s]*)$#i', $url) === 1;
    }
}
