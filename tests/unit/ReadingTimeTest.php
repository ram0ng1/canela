<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Stats\Api\Controller\RecordReadTimeController;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\Validation\ReadTimeValidator;
use Ramon\Canela\Stats\VisitRecorder;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * Tempo de leitura: o navegador diz quanto leu, e o
 * servidor só credita o que cabe no relógio real e no teto do dia.
 */
final class ReadingTimeTest extends TestCase
{
    private Connection $db;

    private Repository $cache;

    private VisitRecorder $visits;

    protected function setUp(): void
    {
        Carbon::setTestNow('2026-10-18 12:00:00');

        $this->db = TestDatabase::connection();
        $this->db->getSchemaBuilder()->create(VisitRecorder::TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->date('visited_at');
            $table->unsignedInteger('posts_read')->default(0);
            $table->unsignedInteger('time_read')->default(0);
            $table->boolean('mobile')->default(false);
            $table->unique(['user_id', 'visited_at']);
        });

        $this->cache = new Repository(new ArrayStore());
        $this->visits = new VisitRecorder($this->db, $this->cache);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
    }

    private function credit(int $claimed, int $userId = 1): int
    {
        // O validador da entrada não entra nesta conta: só o relógio.
        $validator = (new \ReflectionClass(ReadTimeValidator::class))->newInstanceWithoutConstructor();
        $controller = new RecordReadTimeController(new StatsSettings(new ArraySettings()), $this->visits, $this->cache, $validator);

        return (fn () => $this->creditedSeconds($userId, $claimed))->call($controller);
    }

    private function user(int $id): User
    {
        $user = new User();
        $user->id = $id;

        return $user;
    }

    public function test_primeiro_envio_tem_teto_proprio(): void
    {
        self::assertSame(30, $this->credit(30));
        self::assertSame(35, $this->credit(500, 2));
    }

    public function test_nunca_passa_do_tempo_real(): void
    {
        $this->credit(30);

        Carbon::setTestNow('2026-10-18 12:00:10');
        // 10 s de relógio + 5 s de folga.
        self::assertSame(15, $this->credit(30));
    }

    /** Duas abas dividem o mesmo relógio: a segunda só leva a folga. */
    public function test_duas_abas_nao_somam(): void
    {
        $this->credit(30);

        Carbon::setTestNow('2026-10-18 12:00:30');
        self::assertSame(30, $this->credit(30));
        self::assertSame(5, $this->credit(30));
    }

    public function test_valor_negativo_nao_credita_nem_avanca_o_relogio(): void
    {
        $this->credit(30);

        Carbon::setTestNow('2026-10-18 12:01:00');
        self::assertSame(0, $this->credit(-100));
        self::assertSame(RecordReadTimeController::MAX_SECONDS_PER_CALL, $this->credit(1000));
    }

    public function test_dia_tem_teto(): void
    {
        $user = $this->user(1);

        $this->visits->addReading($user, VisitRecorder::MAX_TIME_PER_DAY - 10, 3, false);
        $this->visits->addReading($user, 60, 2, false);

        $row = $this->db->table(VisitRecorder::TABLE)->where('user_id', 1)->first();

        self::assertSame(VisitRecorder::MAX_TIME_PER_DAY, (int) $row->time_read);
        self::assertSame(5, (int) $row->posts_read);
        self::assertSame('2026-10-18', (string) $row->visited_at);
    }

    public function test_um_dia_por_linha(): void
    {
        $user = $this->user(1);

        $this->visits->touch($user, false);
        $this->visits->addReading($user, 20, 1, false);

        Carbon::setTestNow('2026-10-19 00:00:01');
        $this->visits->touch($user, true);

        self::assertSame(['2026-10-18', '2026-10-19'], $this->db->table(VisitRecorder::TABLE)->orderBy('visited_at')->pluck('visited_at')->map(fn ($d) => (string) $d)->all());
    }
}
