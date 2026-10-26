<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Carbon\Carbon;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Badges\SingleGrantLock;
use Ramon\Canela\Badges\UserBadge;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * As travas da concessão que o índice único não cobre: emblema de concessão
 * múltipla sem postagem (o `post_id` NULL passa pelo índice) e duas cargas
 * inteiras ao mesmo tempo.
 */
final class BadgeGrantLockTest extends TestCase
{
    private Connection $db;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $resolver = new ConnectionResolver(['default' => $this->db]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);

        $this->db->getSchemaBuilder()->create('canela_user_badges', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('badge_id');
            $table->unsignedInteger('post_id')->nullable();
            $table->dateTime('granted_at');
            $table->unique(['badge_id', 'user_id', 'post_id']);
        });
    }

    protected function tearDown(): void
    {
        Model::unsetConnectionResolver();
    }

    private function grant(int $userId, Carbon $at): UserBadge
    {
        $userBadge = new UserBadge();
        $userBadge->badge_id = 1;
        $userBadge->user_id = $userId;
        $userBadge->post_id = null;
        $userBadge->granted_at = $at;

        return $userBadge;
    }

    public function test_aniversario_nao_duplica_e_o_seguinte_entra(): void
    {
        $lock = new SingleGrantLock(new Repository(new ArrayStore()), waitSeconds: 0);
        $first = Carbon::parse('2025-03-10 12:00:00');

        self::assertTrue($lock->saveRepeat($this->grant(5, $first)));
        // A mesma data (outra carga com a mesma leitura): fica de fora.
        self::assertFalse($lock->saveRepeat($this->grant(5, $first->copy())));
        // O aniversário do ano seguinte entra, e outra pessoa também.
        self::assertTrue($lock->saveRepeat($this->grant(5, $first->copy()->addYear())));
        self::assertTrue($lock->saveRepeat($this->grant(6, $first->copy())));

        self::assertSame(2, $this->db->table('canela_user_badges')->where('user_id', 5)->count());
    }

    public function test_aniversario_com_outro_processo_gravando_desiste(): void
    {
        $cache = new Repository(new ArrayStore());
        $lock = new SingleGrantLock($cache, waitSeconds: 0);
        $at = Carbon::parse('2025-03-10 12:00:00');

        // Outra carga segura a trava de (emblema, pessoa): está gravando o mesmo aniversário.
        $other = $cache->getStore()->lock('canela.badge-grant.1.5', 10);
        self::assertTrue($other->get());
        self::assertFalse($lock->saveRepeat($this->grant(5, $at)));
        $other->release();

        self::assertTrue($lock->saveRepeat($this->grant(5, $at)));
        self::assertSame(1, $this->db->table('canela_user_badges')->count());
    }

    public function test_uma_carga_por_vez(): void
    {
        $cache = new Repository(new ArrayStore());
        $lock = new SingleGrantLock($cache, waitSeconds: 0);

        $inner = 'não rodou';
        $outer = $lock->exclusiveBackfill(function () use ($lock, &$inner): int {
            // Outra carga começa enquanto esta roda: é pulada.
            $inner = $lock->exclusiveBackfill(static fn (): int => 99);

            return 7;
        });

        self::assertSame(7, $outer);
        self::assertNull($inner);

        // Terminada a primeira, a trava sai: a próxima roda.
        self::assertSame(3, $lock->exclusiveBackfill(static fn (): int => 3));
    }

    public function test_trava_da_carga_sai_mesmo_com_erro(): void
    {
        $lock = new SingleGrantLock(new Repository(new ArrayStore()), waitSeconds: 0);

        try {
            $lock->exclusiveBackfill(static function (): never {
                throw new \RuntimeException('falhou');
            });
        } catch (\RuntimeException) {
        }

        self::assertSame(1, $lock->exclusiveBackfill(static fn (): int => 1));
    }
}
