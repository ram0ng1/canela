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

namespace Ramon\Canela\Ai\Translation;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\Http\AiGate;

/**
 * `POST /api/canela/ai/translate` com `{posts: [ids], discussions: [ids]}`:
 * as traduções das postagens e dos títulos no idioma de quem pede.
 *
 * O fórum chama isto depois de desenhar a página, para o que veio marcado
 * como `canelaTranslatable` — a página nunca espera o modelo. O que não coube
 * neste pedido volta como `pending` e o fórum pede de novo; o que não se
 * traduz (mesmo idioma, invisível, privado) volta como `skip`.
 *
 * Visitantes também disparam (a tradução serve a todos), com limite por IP.
 */
final class TranslateController implements RequestHandlerInterface
{
    private const MAX_IDS = 20;

    /** Pedidos por minuto por pessoa (ou IP): o limite diário cobre o custo, este cobre o abuso. */
    private const PER_MINUTE = 20;

    /**
     * Chamadas ao modelo por dia para cada IP de visitante. Sem isso, um IP
     * sozinho gastava em minutos o limite diário do fórum inteiro.
     */
    private const GUEST_CALLS_PER_DAY = 60;

    public function __construct(
        private readonly ContentTranslator $translator,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $target = $this->translator->target();

        if ($target === null) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $body = AiGate::body($request);
        $ids = static fn (string $key): array => array_slice(array_values(array_unique(array_filter(
            array_map('intval', is_array($body[$key] ?? null) ? $body[$key] : []),
            static fn (int $id): bool => $id > 0
        ))), 0, self::MAX_IDS);

        $postIds = $ids('posts');
        $discussionIds = $ids('discussions');

        if (! $postIds && ! $discussionIds) {
            return new JsonResponse(['posts' => (object) [], 'discussions' => (object) []]);
        }

        $who = $actor->isGuest() ? 'ip:'.sha1((string) $request->getAttribute('ipAddress')) : 'user:'.$actor->id;
        $key = 'canela-ai-translate-rate:'.$who.':'.intdiv(time(), 60);
        // add() + increment(): atômico, ao contrário de get() + put().
        $this->cache->add($key, 0, 120);
        $count = (int) $this->cache->increment($key);

        if ($count > self::PER_MINUTE) {
            // Nada traduzido agora: o fórum tenta de novo mais tarde.
            return new JsonResponse([
                'posts' => (object) array_fill_keys($postIds, ['pending' => true]),
                'discussions' => (object) array_fill_keys($discussionIds, ['pending' => true]),
                'retryAfter' => 60,
            ]);
        }

        // Folga para a parte que já estava no modelo quando o tempo do pedido
        // acabou (ContentTranslator::TIME_BUDGET); o padrão do PHP é 30 s.
        if (function_exists('set_time_limit')) {
            set_time_limit(120);
        }

        if ($actor->isGuest()) {
            $this->translator->limitCaller($who, self::GUEST_CALLS_PER_DAY);
        }

        // Os títulos primeiro: uma chamada só para todos, e é o que se vê primeiro.
        $discussions = $discussionIds ? $this->translator->translateTitles($actor, $discussionIds, $target) : [];
        $posts = $postIds ? $this->translator->translatePosts($actor, $postIds, $target) : [];

        TranslationBuffer::flush();

        return new JsonResponse(['posts' => (object) $posts, 'discussions' => (object) $discussions]);
    }
}
