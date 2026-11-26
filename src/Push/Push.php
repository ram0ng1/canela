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

namespace Ramon\Canela\Push;

use Flarum\Settings\SettingsRepositoryInterface;
use Minishlink\WebPush\VAPID;

/**
 * As chaves e configurações do push e do PWA.
 *
 * As chaves VAPID (que identificam o fórum para os serviços de push dos
 * navegadores) são geradas na primeira vez que alguém pede a pública e
 * ficam nas configurações. Trocá-las invalida todos os aparelhos.
 */
final class Push
{
    public const PWA = 'canela.pwa_enabled';
    public const ENABLED = 'canela.push_enabled';
    public const PUBLIC_KEY = 'canela.push_vapid_public';
    public const PRIVATE_KEY = 'canela.push_vapid_private';

    /**
     * Os serviços de push dos navegadores (Chrome/Edge/Opera, Firefox,
     * Windows e Safari). O servidor faz um POST para o endpoint a cada
     * notificação: sem esta lista, qualquer conta podia cadastrar um endereço
     * da rede interna e fazer o fórum chamá-lo.
     */
    private const HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];

    /** Os mesmos serviços, nos subdomínios que eles usam. */
    private const HOST_SUFFIXES = ['.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function enabled(): bool
    {
        return (bool) $this->settings->get(self::ENABLED);
    }

    /** @return array{publicKey: string, privateKey: string} */
    public function keys(): array
    {
        $public = (string) $this->settings->get(self::PUBLIC_KEY);
        $private = (string) $this->settings->get(self::PRIVATE_KEY);

        if ($public === '' || $private === '') {
            ['publicKey' => $public, 'privateKey' => $private] = VAPID::createVapidKeys();
            $this->settings->set(self::PUBLIC_KEY, $public);
            $this->settings->set(self::PRIVATE_KEY, $private);
        }

        return ['publicKey' => $public, 'privateKey' => $private];
    }

    /** O endpoint é HTTPS, na porta padrão, e de um dos serviços de push. */
    public static function allowedEndpoint(string $endpoint): bool
    {
        $parts = parse_url($endpoint);

        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['port']) || isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        if (in_array($host, self::HOSTS, true)) {
            return true;
        }

        foreach (self::HOST_SUFFIXES as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }
}
