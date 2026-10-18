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

namespace Ramon\Canela\Gaps\Invites\Http;

use Flarum\Http\Exception\RouteNotFoundException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Gaps\Invites\InviteService;

/**
 * GET /api/canela-invite-info/{code} — para a janela de cadastro de quem
 * chegou por um convite: se o código vale e quem convidou ("Fulano convidou
 * você"). Público: o próprio link já é o segredo.
 */
final class InviteInfoController implements RequestHandlerInterface
{
    public function __construct(
        private readonly InviteService $invites,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->invites->enabled()) {
            throw new RouteNotFoundException();
        }

        $invite = $this->invites->findUsable((string) Arr::get($request->getQueryParams(), 'code', ''));

        return new JsonResponse([
            'valid' => $invite !== null,
            'inviter' => $invite?->user?->display_name,
            'signUpOpen' => $this->invites->signUpOpen(),
        ]);
    }
}
