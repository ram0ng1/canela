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

namespace Ramon\Canela\System\Http;

use Flarum\Http\AccessToken;
use Flarum\Http\RequestUtil;
use Flarum\User\Guest;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\System\SystemUser;

/**
 * A rede de segurança do login: a senha já é vetada, mas uma sessão do
 * usuário do sistema poderia nascer por outro caminho (o link de redefinir
 * senha, a confirmação de e-mail, um provedor OAuth, uma chave de API com
 * `userId`). Qualquer requisição que chegue com ele como ator perde a
 * sessão e os tokens dele e segue como visitante.
 */
final class RevokeSystemSession implements MiddlewareInterface
{
    public function __construct(
        private readonly SystemUser $system,
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest() || ! $this->system->is($actor)) {
            return $handler->handle($request);
        }

        AccessToken::query()->where('user_id', $actor->id)->delete();

        // O core já marcou "visto agora" ao autenticar: o sistema nunca está online.
        $actor->newQuery()->whereKey($actor->id)->update(['last_seen_at' => null]);

        $session = $request->getAttribute('session');

        if ($session && method_exists($session, 'invalidate')) {
            $session->invalidate();
        }

        return $handler->handle(RequestUtil::withActor($request, new Guest()));
    }
}
