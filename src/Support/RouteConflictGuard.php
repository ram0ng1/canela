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

namespace Ramon\Canela\Support;

use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Http\RouteCollection;
use Psr\Log\LoggerInterface;

/**
 * Rotas do tema que outra extensão já ocupa saem, em vez de derrubar o fórum.
 *
 * O FastRoute não aceita duas rotas no mesmo endereço (`GET /badges` do tema
 * e do fof/badges, `GET /chat` do tema e do ramon/chat…): o fórum inteiro cai
 * com BadRouteException no boot. A coleção de rotas de cada frontend vira uma
 * GuardedRouteCollection já na criação (`extend` roda antes de qualquer
 * extensão acrescentar rotas e antes de o core pedir a tabela), e ela retira
 * as rotas do tema em conflito na hora de montar a tabela do FastRoute.
 *
 * Antes isto era um `afterResolving`, que rodava depois do `afterResolving`
 * do próprio core: o core monta a tabela ali (a rota padrão `/`), e o fórum
 * caía antes de as rotas repetidas saírem.
 */
final class RouteConflictGuard extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        foreach (['forum', 'api', 'admin'] as $frontend) {
            $this->container->extend(
                "flarum.{$frontend}.routes",
                fn (RouteCollection $routes) => $routes instanceof GuardedRouteCollection
                    ? $routes
                    : GuardedRouteCollection::from($routes, $frontend, $this->logger())
            );
        }
    }

    private function logger(): ?LoggerInterface
    {
        return $this->container->bound(LoggerInterface::class) ? $this->container->make(LoggerInterface::class) : null;
    }
}
