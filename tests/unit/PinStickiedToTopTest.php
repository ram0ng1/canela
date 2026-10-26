<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;
use Flarum\User\Guest;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\ListRoutes\PinStickiedToTop;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * Os fixados sobem, em ordem de criação, e os demais seguem por atividade, em
 * qualquer página, inclusive com mais fixados do que cabem numa página. A
 * consulta vira uma união sem expressão no ORDER BY da tabela inteira.
 */
final class PinStickiedToTopTest extends TestCase
{
    private Connection $db;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $resolver = new ConnectionResolver(['default' => $this->db]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);

        $this->db->getSchemaBuilder()->create('discussions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('title')->default('');
            $table->boolean('is_sticky')->default(false);
            $table->dateTime('created_at')->nullable();
            $table->dateTime('last_posted_at')->nullable();
        });
    }

    protected function tearDown(): void
    {
        Model::unsetConnectionResolver();
    }

    /** @param list<array{0: bool, 1: int, 2: int}> $rows fixado, dias da criação, dias da última atividade */
    private function seed(array $rows): void
    {
        $base = Carbon::parse('2026-01-01 00:00:00');

        foreach ($rows as [$sticky, $created, $posted]) {
            $this->db->table('discussions')->insert([
                'is_sticky' => $sticky,
                'created_at' => $base->copy()->addDays($created),
                'last_posted_at' => $base->copy()->addDays($posted),
            ]);
        }
    }

    /** @return list<int> os ids de uma página, como o buscador do Flarum monta */
    private function page(int $offset, int $limit): array
    {
        $state = new DatabaseSearchState(new Guest(), false);
        $state->setQuery(Discussion::query()->select('discussions.*')->orderBy('last_posted_at', 'desc')->skip($offset)->take($limit + 1));

        (new PinStickiedToTop(new ArraySettings()))($state, new SearchCriteria(new Guest(), [], $limit, $offset, null, true));

        // O desempate do AbstractSearcher, depois dos mutadores.
        $base = $state->getQuery()->getQuery();

        if ($base->unions) {
            $base->unionOrders[] = ['column' => 'id', 'direction' => 'desc'];
        } else {
            $state->getQuery()->orderBy('discussions.id', 'desc');
        }

        return array_slice($state->getQuery()->get()->pluck('id')->map(static fn ($id): int => (int) $id)->all(), 0, $limit);
    }

    /** @return list<int> a ordem esperada, calculada aqui */
    private function expected(): array
    {
        $rows = $this->db->table('discussions')->get()->all();

        usort($rows, static function ($a, $b): int {
            return [(int) $b->is_sticky, $a->is_sticky ? $a->created_at : '', $b->last_posted_at, $b->id]
                <=> [(int) $a->is_sticky, $b->is_sticky ? $b->created_at : '', $a->last_posted_at, $a->id];
        });

        return array_map(static fn ($row): int => (int) $row->id, $rows);
    }

    public function test_fixados_em_cima_por_criacao_e_o_resto_por_atividade(): void
    {
        // Fixados criados fora de ordem e com atividades variadas.
        $this->seed([[false, 1, 50], [true, 9, 10], [false, 2, 40], [true, 3, 60], [false, 4, 45], [true, 6, 5], [false, 5, 30]]);

        self::assertSame($this->expected(), $this->page(0, 20));
    }

    public function test_paginas_sem_repetir_nem_pular_com_muitos_fixados(): void
    {
        $rows = [];

        for ($i = 0; $i < 37; $i++) {
            // 13 fixados (mais que uma página de 5), com criação e atividade embaralhadas.
            $rows[] = [$i % 3 === 0, ($i * 7) % 37, ($i * 11) % 23];
        }

        $this->seed($rows);

        $all = [];

        for ($offset = 0; $offset < 40; $offset += 5) {
            $all = [...$all, ...$this->page($offset, 5)];
        }

        self::assertSame($this->expected(), $all);
    }
}
