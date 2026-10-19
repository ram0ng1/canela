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

namespace Ramon\Canela\MeToo\Api;

use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Exception\FloodingException;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\MeToo\Event\Toggled;
use Ramon\Canela\MeToo\MeToo;

/**
 * POST /api/canela-me-too `{discussionId}`: o `POST /solution/shared_issue`
 * do Discourse. Alterna o "Eu também" de quem chama e devolve a contagem nova,
 * se marcou, e a inscrição no tópico (para o botão de notificações do rodapé
 * mudar junto).
 *
 * Visitante recebe 401 (o fórum abre o login antes de chegar aqui); tópico que
 * a pessoa não vê, 404; sem permissão, 403; mais de 5 trocas na hora, 429.
 */
final class ToggleMeTooController implements RequestHandlerInterface
{
    public function __construct(
        private readonly MeToo $meToo,
        private readonly Cache $cache,
        private readonly Dispatcher $events,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->meToo->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id = (int) Arr::get((array) $request->getParsedBody(), 'discussionId', 0);

        /** @var Discussion|null $discussion */
        $discussion = $id > 0 ? Discussion::query()->whereVisibleTo($actor)->find($id) : null;

        if (! $discussion) {
            throw new ModelNotFoundException();
        }

        if (! $this->meToo->canToggle($actor, $discussion)) {
            throw new PermissionDeniedException();
        }

        if (! $actor->isAdmin() && ! $this->withinRate((int) $actor->id, (int) $discussion->id)) {
            throw new FloodingException();
        }

        $result = $this->meToo->toggle($discussion, $actor);

        // Quem ouve (a entrega em tempo real, com o flarum/realtime) não pode
        // desfazer o clique: a marcação já está gravada e a resposta sai igual.
        try {
            $this->events->dispatch(new Toggled($discussion, $actor, $result['mine'], $result['count']));
        } catch (\Throwable $error) {
            error_log('[ramon/canela] me too: aviso da troca falhou: '.$error->getMessage());
        }

        return new JsonResponse($result);
    }

    /** Janela fixa de uma hora: a chave muda a cada hora e vence sozinha. */
    private function withinRate(int $userId, int $discussionId): bool
    {
        $key = sprintf('canela.metoo.rate.%d.%d.%d', $userId, $discussionId, intdiv(time(), MeToo::RATE_WINDOW));

        $this->cache->add($key, 0, MeToo::RATE_WINDOW + 60);

        return (int) $this->cache->increment($key) <= MeToo::RATE_LIMIT;
    }
}
