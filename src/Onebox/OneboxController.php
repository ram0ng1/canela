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

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * `GET /api/canela/onebox?url=…`: o cartão de um link do GitHub que está
 * sozinho numa linha de uma postagem. `data: null` quando o link não vira
 * cartão (outro formato, privado, não existe, GitHub fora do ar): o fórum
 * deixa o link como está.
 *
 * Um cartão em cache sai sem custo; só os que vão ao GitHub contam no limite
 * por pessoa (ou IP, para visitantes).
 */
final class OneboxController implements RequestHandlerInterface
{
    /** Pedidos ao GitHub por minuto por pessoa. */
    private const PER_MINUTE = 30;

    public function __construct(
        private readonly OneboxSettings $settings,
        private readonly GithubOnebox $github,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->githubEnabled()) {
            throw new RouteNotFoundException();
        }

        $value = $request->getQueryParams()['url'] ?? null;
        $url = is_string($value) ? GithubUrl::parse($value) : null;

        if ($url === null) {
            return new JsonResponse(['data' => null]);
        }

        $card = $this->github->cached($url);

        if ($card === null) {
            $actor = RequestUtil::getActor($request);
            $who = $actor->isGuest() ? 'ip:'.sha1((string) $request->getAttribute('ipAddress')) : 'user:'.$actor->id;
            $key = 'canela.onebox.rate.'.sha1($who).'.'.intdiv(time(), 60);
            // add() + increment(): atômico, ao contrário de get() + put().
            $this->cache->add($key, 0, 120);

            if ((int) $this->cache->increment($key) > self::PER_MINUTE) {
                return new JsonResponse(['data' => null, 'retryAfter' => 60]);
            }

            $card = $this->github->card($url);
        }

        return new JsonResponse(['data' => isset($card['error']) ? null : $card]);
    }
}
