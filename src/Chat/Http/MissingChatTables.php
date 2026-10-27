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

namespace Ramon\Canela\Chat\Http;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Support\Log;

/**
 * Tabelas do chat ainda não migradas (o tema atualizado antes do `migrate`):
 * na API do chat, o chat some com um 404, em vez de um erro 500.
 *
 * Fica num middleware da API, por dentro do tratador de erros do Flarum: os
 * recursos JSON:API não têm um ponto único para o `try`, e o 404 tem de valer
 * só para as rotas do chat — fora delas, a tabela que falta é um erro de
 * verdade e segue como tal.
 *
 * Tabela ou coluna inexistente: 42S02/42S22 no MySQL/MariaDB, 42P01/42703 no
 * PostgreSQL.
 */
final class MissingChatTables implements MiddlewareInterface
{
    private const CODES = ['42S02', '42S22', '42P01', '42703'];

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        try {
            return $handler->handle($request);
        } catch (QueryException $error) {
            if (in_array($error->getCode(), self::CODES, true) && self::isChatRoute($request) && str_contains($error->getMessage(), 'canela_chat_')) {
                Log::warning('chat indisponível, falta migrar: '.$error->getMessage());

                throw new ModelNotFoundException();
            }

            throw $error;
        }
    }

    private static function isChatRoute(ServerRequestInterface $request): bool
    {
        return (bool) preg_match('#/(chat-channels|chat-messages|chat-threads|chat/|users/canela-chat)#', $request->getUri()->getPath());
    }
}
