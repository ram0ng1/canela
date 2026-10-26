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

namespace Ramon\Canela\Ai\Http;

use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\NotAuthenticatedException;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\UsageLimiter;

/**
 * As portas de entrada da API da IA, conferidas ANTES de o stream começar —
 * depois dos cabeçalhos, um erro já não pode virar um status HTTP.
 *
 * - Recurso desligado (ou IA sem provedor, ou tabelas por criar): 404, como
 *   se a rota não existisse.
 * - Visitante: 401. Fora dos grupos permitidos: 403.
 * - Limite diário esgotado: 422 com a mensagem, que o fórum mostra num alerta.
 */
final class AiGate
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly UsageLimiter $usage,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function feature(string $key): void
    {
        if (! $this->settings->feature($key)) {
            throw new RouteNotFoundException();
        }
    }

    /** Bot, ajudante e "Perguntar à IA": logado e num dos grupos permitidos. */
    public function user(User $actor): void
    {
        if ($actor->isGuest()) {
            throw new NotAuthenticatedException();
        }

        if (! $this->settings->canUse($actor)) {
            throw new PermissionDeniedException();
        }
    }

    public function quota(User $actor): void
    {
        if ($this->usage->exhausted($actor)) {
            throw new ValidationException(['ai' => $this->translator->trans('ramon-canela.api.ai.errors.limit_reached')]);
        }
    }

    /** Gasta um pedido do limite diário, ou recusa (ver UsageLimiter::claim). */
    public function claim(User $actor): void
    {
        if (! $this->usage->claim($actor)) {
            throw new ValidationException(['ai' => $this->translator->trans('ramon-canela.api.ai.errors.limit_reached')]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public static function body(ServerRequestInterface $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? $body : [];
    }

    public static function routeId(ServerRequestInterface $request): int
    {
        return (int) ($request->getQueryParams()['id'] ?? 0);
    }
}
