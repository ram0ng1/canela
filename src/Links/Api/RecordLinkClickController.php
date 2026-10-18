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

namespace Ramon\Canela\Links\Api;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Links\LinkClicks;
use Ramon\Canela\Stats\Http\Visitor;
use Ramon\Canela\Stats\StatsSettings;

/**
 * POST /api/canela-link-click — o `/clicks/track` do Discourse. O fórum manda
 * por `navigator.sendBeacon` (corpo de formulário, com o csrfToken) quando
 * alguém clica num link externo de uma postagem, logado ou não.
 *
 * Responde sempre 204, gravando ou não: o navegador já foi para o link e não
 * lê a resposta, e quem tenta inflar números não descobre o que contou. Só
 * conta se:
 * - a postagem existe e quem clicou pode vê-la;
 * - o endereço é mesmo um link externo daquela postagem;
 * - não é robô;
 * - a mesma pessoa (ou o mesmo IP, para visitantes) não clicou nesse link
 *   dessa postagem nas últimas 24 horas, e não passou do teto por minuto.
 */
final class RecordLinkClickController implements RequestHandlerInterface
{
    public function __construct(
        private readonly LinkClicks $clicks,
        private readonly StatsSettings $stats,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->clicks->enabled()) {
            throw new RouteNotFoundException();
        }

        $done = new EmptyResponse(204);
        $visitor = new Visitor($request);

        if ($visitor->isCrawler()) {
            return $done;
        }

        $body = (array) $request->getParsedBody();
        $url = trim((string) Arr::get($body, 'url', ''));
        $postId = (int) Arr::get($body, 'post_id', 0);

        if ($postId <= 0 || $url === '' || mb_strlen($url) > LinkClicks::MAX_URL_LENGTH || ! $this->clicks->isExternal($url)) {
            return $done;
        }

        $actor = RequestUtil::getActor($request);
        $who = $actor->isGuest() ? 'ip:'.$visitor->ipHash($this->stats->visitorSalt()) : 'u:'.$actor->id;

        if (! $this->withinRate($who)) {
            return $done;
        }

        /** @var Post|null $post */
        $post = Post::query()->whereVisibleTo($actor)->where('type', 'comment')->find($postId);

        if (! $post || ! in_array($url, array_column(LinkClicks::extract($post->getRawOriginal('content')), 'url'), true)) {
            return $done;
        }

        // add() só grava se a chave não existe: dois cliques ao mesmo tempo
        // não passam os dois.
        $dedupeKey = 'canela.links.click.'.sha1($who.'|'.$post->id.'|'.$url);

        if (! $this->cache->add($dedupeKey, true, LinkClicks::DEDUPE_SECONDS)) {
            return $done;
        }

        $this->clicks->record($post, $url, $actor->isGuest() ? null : (int) $actor->id);

        return $done;
    }

    private function withinRate(string $who): bool
    {
        $key = 'canela.links.rate.'.sha1($who).'.'.intdiv(time(), 60);

        $this->cache->add($key, 0, 120);

        return (int) $this->cache->increment($key) <= LinkClicks::MAX_PER_MINUTE;
    }
}
