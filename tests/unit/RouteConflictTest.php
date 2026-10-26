<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use FastRoute\BadRouteException;
use Flarum\Http\RouteCollection;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Support\GuardedRouteCollection;

/** Rotas do tema que colidem com as de outra extensão saem; o fórum não cai no boot. */
final class RouteConflictTest extends TestCase
{
    /** @param list<array{0: string, 1: string, 2: string}> $routes [método, caminho, nome] */
    private function collection(array $routes): GuardedRouteCollection
    {
        $plain = new RouteCollection();

        foreach ($routes as [$method, $path, $name]) {
            $plain->addRoute($method, $path, $name, 'handler:'.$name);
        }

        return GuardedRouteCollection::from($plain, 'forum');
    }

    /** O nome da rota que atende `GET $path` na tabela montada. */
    private function handlerFor(RouteCollection $routes, string $path): ?string
    {
        [$static] = $routes->getRouteData();

        return $static['GET'][$path]['name'] ?? null;
    }

    public function test_mesmo_caminho_fica_a_da_outra_extensao(): void
    {
        // O fof/badges registra `/badges` depois do tema (a ordem das extensões).
        $routes = $this->collection([['GET', '/badges', 'canela.badges'], ['GET', '/badges', 'badges']]);

        self::assertSame('badges', $this->handlerFor($routes, '/badges'));
        self::assertArrayNotHasKey('canela.badges', $routes->getRoutes());
    }

    public function test_mesmo_caminho_com_o_tema_depois(): void
    {
        $routes = $this->collection([['GET', '/badges', 'badges'], ['GET', '/badges', 'canela.badges']]);

        self::assertSame('badges', $this->handlerFor($routes, '/badges'));
    }

    public function test_rota_fixa_encoberta_por_variavel_do_tema(): void
    {
        // `/{page:tos|privacy}` do tema, registrado antes, encobria um `/privacy` de outra extensão.
        $routes = $this->collection([['GET', '/{page:tos|privacy}', 'canela.legal'], ['GET', '/privacy', 'pages.privacy']]);

        self::assertSame('pages.privacy', $this->handlerFor($routes, '/privacy'));
        self::assertArrayNotHasKey('canela.legal', $routes->getRoutes());
    }

    public function test_variaveis_com_o_mesmo_padrao(): void
    {
        $routes = $this->collection([['GET', '/badges/{id:\d+}', 'canela.badge'], ['GET', '/badges/{id:\d+}', 'badge']]);
        $routes->getRouteData();

        self::assertSame(['badge'], array_keys($routes->getRoutes()));
    }

    public function test_rotas_sem_conflito_ficam(): void
    {
        $routes = $this->collection([
            ['GET', '/badges', 'canela.badges'],
            ['GET', '/badges/{id:\d+}[/{slug}]', 'canela.badge'],
            ['GET', '/', 'index'],
            ['POST', '/badges', 'badges.create'],
        ]);
        $routes->getRouteData();

        self::assertCount(4, $routes->getRoutes());
    }

    public function test_endpoint_do_tema_num_recurso_do_core(): void
    {
        self::assertTrue(GuardedRouteCollection::isOurs('discussions.canelaView'));
        self::assertTrue(GuardedRouteCollection::isOurs('canela-badges.index'));
        self::assertFalse(GuardedRouteCollection::isOurs('badges.index'));
    }

    public function test_conflito_entre_outras_extensoes_nao_e_do_tema(): void
    {
        // O tema não esconde o erro de duas outras extensões: ele continua aparecendo.
        $routes = $this->collection([['GET', '/x', 'a'], ['GET', '/x', 'b']]);

        $this->expectException(BadRouteException::class);
        $routes->getRouteData();
    }

    public function test_rota_ja_aplicada_nao_sai(): void
    {
        $drop = GuardedRouteCollection::conflictsToDrop(
            ['canela.badges' => ['method' => 'GET', 'path' => '/badges'], 'badges' => ['method' => 'GET', 'path' => '/badges']],
            ['badges']
        );

        self::assertSame([], $drop);
    }
}
