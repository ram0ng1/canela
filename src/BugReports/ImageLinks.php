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

namespace Ramon\Canela\BugReports;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Str;

/**
 * Links assinados das capturas, para as instruções coladas numa IA: quem tem
 * o link abre a imagem sem login, até ele vencer (7 dias). A assinatura usa
 * um segredo próprio do recurso, gerado na primeira vez.
 */
final class ImageLinks
{
    public const SECRET = 'canela.bug_reports_secret';

    public const LIFETIME = 7 * 24 * 3600;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    private function secret(): string
    {
        $secret = (string) $this->settings->get(self::SECRET);

        if (strlen($secret) < 32) {
            $secret = Str::random(48);
            $this->settings->set(self::SECRET, $secret);
        }

        return $secret;
    }

    public static function signature(string $secret, int $id, string $which, int $expires): string
    {
        return hash_hmac('sha256', $id.'|'.$which.'|'.$expires, $secret);
    }

    /** O sufixo `?exp=…&sig=…` de uma captura. */
    public function query(int $id, string $which, ?int $now = null): string
    {
        $expires = ($now ?? time()) + self::LIFETIME;

        return '?exp='.$expires.'&sig='.self::signature($this->secret(), $id, $which, $expires);
    }

    public function valid(int $id, string $which, mixed $expires, mixed $signature, ?int $now = null): bool
    {
        if (! is_numeric($expires) || ! is_string($signature) || (int) $expires < ($now ?? time())) {
            return false;
        }

        $secret = (string) $this->settings->get(self::SECRET);

        return strlen($secret) >= 32 && hash_equals(self::signature($secret, $id, $which, (int) $expires), $signature);
    }
}
