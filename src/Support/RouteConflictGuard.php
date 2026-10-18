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
 * O FastRoute não aceita duas rotas com o mesmo método e caminho (`GET /chat`
 * do tema e do ramon/chat, `GET /search` do tema e do avocado…): o fórum
 * inteiro cai com BadRouteException no boot. Aqui, depois que todas as
 * extensões registraram as suas (afterResolving roda depois de todos os
 * extend/resolving da coleção), cada caminho repetido fica com a rota da
 * outra extensão e a do tema (nome `canela.*`) é retirada — o recurso do tema
 * que dependia dela simplesmente não aparece naquele endereço.
 */
final class RouteConflictGuard extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        foreach (['forum', 'api', 'admin'] as $frontend) {
            $this->container->afterResolving(
                "flarum.{$frontend}.routes",
                fn (RouteCollection $routes) => $this->dropDuplicates($routes, $frontend)
            );
        }
    }

    private function dropDuplicates(RouteCollection $routes, string $frontend): void
    {
        foreach (self::duplicatesToDrop($routes->getRoutes()) as $key => $drop) {
            foreach ($drop as $name) {
                $routes->removeRoute($name);
            }

            $this->logger()?->info("[canela] rota {$frontend} {$key} já registrada por outra extensão; a do tema foi retirada: ".implode(', ', $drop));
        }
    }

    /**
     * Para cada "MÉTODO caminho" repetido, os nomes a retirar: os do tema
     * (`canela*`) quando outra extensão tem a mesma rota; só o tema repetindo
     * a si mesmo, todas menos a primeira.
     *
     * @param array<string, array{method: string, path: string}> $routes
     * @return array<string, list<string>>
     */
    public static function duplicatesToDrop(array $routes): array
    {
        $byPath = [];

        foreach ($routes as $name => $route) {
            $byPath[strtoupper((string) $route['method']).' '.$route['path']][] = (string) $name;
        }

        $result = [];

        foreach ($byPath as $key => $names) {
            if (count($names) < 2) {
                continue;
            }

            $ours = array_values(array_filter($names, static fn (string $name): bool => str_starts_with($name, 'canela')));
            $drop = count($ours) === count($names) ? array_slice($ours, 1) : $ours;

            if ($drop !== []) {
                $result[$key] = $drop;
            }
        }

        return $result;
    }

    private function logger(): ?LoggerInterface
    {
        return $this->container->bound(LoggerInterface::class) ? $this->container->make(LoggerInterface::class) : null;
    }
}
