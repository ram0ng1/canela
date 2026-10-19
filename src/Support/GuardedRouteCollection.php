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

use FastRoute\BadRouteException;
use FastRoute\DataGenerator\GroupCountBased;
use FastRoute\RouteParser\Std;
use Flarum\Http\RouteCollection;
use Psr\Log\LoggerInterface;

/**
 * A coleção de rotas do Flarum que, antes de montar a tabela do FastRoute,
 * retira as rotas do tema que colidem com as de outra extensão.
 *
 * O FastRoute recusa (e o fórum inteiro cai no boot com BadRouteException):
 * - duas rotas com o mesmo método e caminho (`GET /badges` do tema e do
 *   fof/badges);
 * - duas rotas variáveis com o mesmo padrão;
 * - uma rota fixa encoberta por uma variável registrada antes (o
 *   `/{page:tos|privacy}` do tema e um `/privacy` de outra extensão).
 *
 * A tabela é montada na primeira vez que alguém pede as rotas — o próprio
 * core faz isso logo depois de criar a coleção (a rota padrão `/`), antes de
 * qualquer extensão conseguir reagir —, então a checagem fica aqui dentro,
 * e não num ouvinte de fora. Em cada conflito sai a rota do tema; a da outra
 * extensão fica, e o recurso do tema que dependia dela não aparece naquele
 * endereço.
 */
class GuardedRouteCollection extends RouteCollection
{
    private ?LoggerInterface $logger = null;

    private string $frontend = '';

    /** A mesma coleção (rotas e ordem), agora com a checagem. */
    public static function from(RouteCollection $routes, string $frontend, ?LoggerInterface $logger = null): self
    {
        $guarded = new self();
        $guarded->frontend = $frontend;
        $guarded->logger = $logger;

        foreach ($routes->getRoutes() as $name => $route) {
            $guarded->addRoute($route['method'], $route['path'], (string) $name, $route['handler']);
        }

        return $guarded;
    }

    #[\Override]
    protected function applyRoutes(): void
    {
        foreach (self::conflictsToDrop($this->routes, array_keys($this->pendingRoutes)) as $name => $reason) {
            $this->removeRoute($name);
            $this->logger?->debug("[canela] rota {$this->frontend} \"{$name}\" retirada: {$reason}");
        }

        parent::applyRoutes();
    }

    /**
     * As rotas do tema a retirar para o FastRoute aceitar a tabela, com o
     * motivo. Só saem rotas do tema ainda não aplicadas; um conflito entre
     * duas rotas de outras extensões não é do tema e fica como está.
     *
     * @param array<string, array{method: string, path: string, handler?: mixed}> $routes na ordem de registro
     * @param list<string>|null $pending as que ainda podem sair (null: todas)
     * @return array<string, string>
     */
    public static function conflictsToDrop(array $routes, ?array $pending = null): array
    {
        $removable = static fn (string $name): bool => self::isOurs($name) && ($pending === null || in_array($name, $pending, true));
        $drop = [];

        // Cada retirada pode destravar a seguinte: refaz a simulação do zero até
        // passar inteira (no máximo uma volta por rota).
        for ($round = 0; $round <= count($routes); $round++) {
            $generator = new GroupCountBased();
            $added = [];
            $conflict = null;

            foreach ($routes as $name => $route) {
                $name = (string) $name;

                if (isset($drop[$name])) {
                    continue;
                }

                try {
                    self::add($generator, $route);
                    $added[$name] = $route;
                } catch (BadRouteException $error) {
                    $conflict = [$name, $route, $error->getMessage()];
                    break;
                }
            }

            if ($conflict === null) {
                return $drop;
            }

            [$name, $route, $message] = $conflict;

            // A rota que não entrou é do tema: sai ela.
            if ($removable($name)) {
                $drop[$name] = $message;

                continue;
            }

            // A que não entrou é de outra extensão: sai a rota do tema, já aceita,
            // que a bloqueia.
            $culprit = null;

            foreach ($added as $earlier => $earlierRoute) {
                if ($removable($earlier) && self::clash($earlierRoute, $route)) {
                    $culprit = $earlier;
                    break;
                }
            }

            if ($culprit === null) {
                return $drop;
            }

            $drop[$culprit] = "\"{$name}\" de outra extensão usa o mesmo endereço";
        }

        return $drop;
    }

    /** Uma rota do tema: `canela…` (páginas e API) ou um endpoint `….canela…` num recurso do core. */
    public static function isOurs(string $name): bool
    {
        return str_starts_with($name, 'canela') || str_contains($name, '.canela');
    }

    /** @param array{method: string, path: string} $route */
    private static function add(GroupCountBased $generator, array $route): void
    {
        foreach ((new Std())->parse($route['path']) as $routeData) {
            // Um handler qualquer, mas não null: o FastRoute acha a repetição com isset().
            $generator->addRoute($route['method'], $routeData, true);
        }
    }

    /**
     * @param array{method: string, path: string} $first
     * @param array{method: string, path: string} $second
     */
    private static function clash(array $first, array $second): bool
    {
        $generator = new GroupCountBased();

        try {
            self::add($generator, $first);
            self::add($generator, $second);
        } catch (BadRouteException) {
            return true;
        }

        return false;
    }
}
