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

use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Gaps\Invites\Invite;
use Ramon\Canela\Gaps\Invites\InviteService;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * /api/canela-invites — os convites de quem está logado:
 *
 * - GET lista os convites dele;
 * - POST gera um link novo ({maxRedemptions, expiresDays});
 * - DELETE /api/canela-invites/{id} apaga um convite dele.
 *
 * Um controlador só para os três verbos: as regras (recurso ligado, conta,
 * dono do convite) são as mesmas; a permissão de convidar, só para gerar.
 */
final class InvitesController implements RequestHandlerInterface
{
    /** A mensagem de quando a pessoa já tem o máximo de convites ativos (nos três idiomas). */
    public const TOO_MANY_KEY = 'ramon-canela.api.invites.too_many';

    public function __construct(
        private readonly InviteService $invites,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->invites->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        // A permissão vale para gerar. Listar e apagar os próprios convites,
        // não: quem perdeu a permissão (mudou de grupo, foi suspenso) ainda
        // precisa ver e revogar os links que espalhou — e eles já não valem
        // (InviteService::findUsable confere o dono a cada uso).
        if ($request->getMethod() === 'POST' && ! $this->invites->canCreate($actor)) {
            throw new PermissionDeniedException();
        }

        return match ($request->getMethod()) {
            'POST' => $this->create($request),
            'DELETE' => $this->delete($request),
            default => $this->list($request),
        };
    }

    private function list(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        return new JsonResponse([
            'invites' => array_map(fn (Invite $invite) => $this->invites->present($invite), $this->invites->listFor($actor)),
            'signUpOpen' => $this->invites->signUpOpen(),
            // Para o fórum esconder o botão "Gerar" de quem só pode revogar.
            'canCreate' => $this->invites->canCreate($actor),
        ]);
    }

    private function create(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $body = (array) $request->getParsedBody();

        $max = (int) Arr::get($body, 'maxRedemptions', 1);
        $days = Arr::has($body, 'expiresDays') ? (int) Arr::get($body, 'expiresDays') : null;

        try {
            $invite = $this->invites->create($actor, $max, $days);
        } catch (\RuntimeException) {
            throw new ValidationException(['invites' => $this->translator->trans(self::TOO_MANY_KEY)]);
        }

        return new JsonResponse(['invite' => $this->invites->present($invite)], 201);
    }

    private function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);

        // Só os próprios convites: o de outra pessoa responde como inexistente.
        $invite = Invite::query()->where('user_id', $actor->id)->findOrFail($id);
        $invite->delete();

        return new EmptyResponse(204);
    }
}
