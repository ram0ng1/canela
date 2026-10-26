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

namespace Ramon\Canela\Chat\Api;

use Flarum\Http\RequestUtil;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Support\Log;

/**
 * Base dos endpoints `/api/chat/*`.
 *
 * Todo endpoint passa pelas mesmas portas, nesta ordem: o chat ligado no admin
 * (senão 404), um usuário logado (401) que pode usar o chat (403). Os erros são
 * as exceções do Flarum, que o tratador da API já transforma no JSON de erro
 * que o `app.request` do fórum mostra num alerta.
 *
 * Um endpoint por caminho; o método HTTP escolhe a ação (GET lista, POST cria…).
 */
abstract class AbstractChatController implements RequestHandlerInterface
{
    public function __construct(
        protected readonly ChatAccess $access,
        protected readonly ChatService $service,
        protected readonly ChatPresenter $presenter,
    ) {
    }

    final public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->access->settings()->assertEnabled();

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $this->access->assertCanUse($actor);

        try {
            $result = $this->respond($request, $actor, strtoupper($request->getMethod()));
        } catch (QueryException $error) {
            // Tabelas do chat ainda não migradas (o tema atualizado antes do
            // `migrate`): o chat some com um 404, em vez de um erro 500.
            // Tabela ou coluna inexistente: 42S02/42S22 no MySQL/MariaDB,
            // 42P01/42703 no PostgreSQL.
            if (in_array($error->getCode(), ['42S02', '42S22', '42P01', '42703'], true)) {
                Log::warning('chat indisponível, falta migrar: '.$error->getMessage());

                throw new ModelNotFoundException();
            }

            throw $error;
        }

        if ($result instanceof ResponseInterface) {
            return $result;
        }

        return $result === null ? new EmptyResponse(204) : new JsonResponse($result);
    }

    /**
     * @return array<string, mixed>|ResponseInterface|null
     */
    abstract protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null;

    protected function routeInt(ServerRequestInterface $request, string $name): int
    {
        return (int) ($request->getQueryParams()[$name] ?? 0);
    }

    /** @return array<string, mixed> */
    protected function body(ServerRequestInterface $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? $body : [];
    }

    protected function query(ServerRequestInterface $request, string $name): ?string
    {
        $value = $request->getQueryParams()[$name] ?? null;

        return is_scalar($value) ? (string) $value : null;
    }

    protected function channel(ServerRequestInterface $request, User $actor): Channel
    {
        return $this->access->findChannel($this->routeInt($request, 'id'), $actor);
    }

    /**
     * A mensagem pelo id, se o ator enxerga o canal dela (e, apagada, se pode
     * vê-la apagada).
     *
     * @return array{0: Message, 1: Channel}
     */
    protected function message(ServerRequestInterface $request, User $actor): array
    {
        /** @var Message|null $message */
        $message = Message::query()->find($this->routeInt($request, 'id'));

        if (! $message) {
            throw new ModelNotFoundException();
        }

        $channel = $this->access->findChannel($message->channel_id, $actor);

        if ($message->isDeleted() && ! $this->access->canSeeDeleted($message, $channel, $actor)) {
            throw new ModelNotFoundException();
        }

        return [$message, $channel];
    }

    /** @return array{0: Thread, 1: Channel} */
    protected function thread(int $id, User $actor): array
    {
        /** @var Thread|null $thread */
        $thread = Thread::query()->find($id);

        if (! $thread) {
            throw new ModelNotFoundException();
        }

        $channel = $this->access->findChannel($thread->channel_id, $actor);

        if (! $this->access->threadsOn($channel)) {
            throw new ModelNotFoundException();
        }

        return [$thread, $channel];
    }

    /**
     * Uma mensagem pronta para a resposta, com os usuários que ela cita.
     *
     * @return array<string, mixed>
     */
    protected function presentMessage(Message $message, Channel $channel, User $actor): array
    {
        $message->refresh();

        return [
            'message' => $this->presenter->messages([$message], $channel, $actor)[0] ?? null,
            'users' => $this->presenter->users(),
        ];
    }

    /** @return array<string, mixed> */
    protected function presentChannel(Channel $channel, User $actor): array
    {
        $channel->refresh();

        return [
            'channel' => $this->presenter->channels([$channel], $actor)[0] ?? null,
            'users' => $this->presenter->users(),
        ];
    }
}
