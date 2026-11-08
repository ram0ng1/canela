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

namespace Ramon\Canela\Push\Http;

use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * O manifesto do PWA: nome, cor e ícone vêm da Aparência do fórum. Para o
 * navegador oferecer "Instalar", o favicon precisa ser um PNG de 512 px.
 */
final class ManifestController implements RequestHandlerInterface
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $base = rtrim($this->url->to('forum')->base(), '/').'/';
        $title = (string) $this->settings->get('forum_title');
        $icons = [];

        foreach (['favicon_path' => 'any', 'logo_path' => 'any'] as $key => $sizes) {
            if ($path = $this->settings->get($key)) {
                $icons[] = ['src' => $this->url->to('forum')->base().'/assets/'.$path, 'sizes' => $sizes];
            }
        }

        return new JsonResponse([
            'name' => $title,
            'short_name' => mb_substr($title, 0, 12),
            'description' => (string) $this->settings->get('forum_description'),
            'start_url' => $base,
            'scope' => $base,
            'display' => 'standalone',
            'theme_color' => (string) $this->settings->get('theme_primary_color'),
            'background_color' => '#ffffff',
            'icons' => $icons,
        ], 200, ['Content-Type' => 'application/manifest+json'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
