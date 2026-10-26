<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Carbon\Carbon;
use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicViewRecorder;
use Ramon\Canela\Stats\TopicViewStats;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * A reserva da visualização de tópico: uma por pessoa (conta ou IP do
 * visitante) por janela, e só uma de duas abas que chegam juntas.
 */
final class TopicViewClaimTest extends TestCase
{
    private Connection $db;

    private TopicViewRecorder $recorder;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->getSchemaBuilder()->create(TopicViewRecorder::TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('discussion_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->dateTime('viewed_at');
            $table->unique(['discussion_id', 'user_id']);
            $table->unique(['discussion_id', 'ip_hash']);
        });

        $this->recorder = new TopicViewRecorder($this->db, new StatsSettings(new ArraySettings()), new TopicViewStats($this->db));
    }

    /** @param array{user_id: int|null, ip_hash: string|null} $identity */
    private function claim(array $identity, string $now, int $discussionId = 1): bool
    {
        return (fn () => $this->claim($discussionId, $identity, Carbon::parse($now), 8))->call($this->recorder);
    }

    public function test_membro_conta_uma_vez_por_janela(): void
    {
        $member = ['user_id' => 5, 'ip_hash' => null];

        self::assertTrue($this->claim($member, '2026-10-18 09:00:00'));
        self::assertFalse($this->claim($member, '2026-10-18 09:00:00'));
        self::assertFalse($this->claim($member, '2026-10-18 16:59:00'));
        self::assertTrue($this->claim($member, '2026-10-18 17:00:00'));
        // Outro tópico é outra conta.
        self::assertTrue($this->claim($member, '2026-10-18 17:00:00', 2));
    }

    public function test_dia_novo_conta_de_novo(): void
    {
        $member = ['user_id' => 5, 'ip_hash' => null];

        self::assertTrue($this->claim($member, '2026-10-18 23:00:00'));
        self::assertTrue($this->claim($member, '2026-10-19 00:30:00'));
    }

    public function test_visitantes_se_separam_pelo_ip(): void
    {
        self::assertTrue($this->claim(['user_id' => null, 'ip_hash' => 'a'], '2026-10-18 09:00:00'));
        self::assertFalse($this->claim(['user_id' => null, 'ip_hash' => 'a'], '2026-10-18 10:00:00'));
        self::assertTrue($this->claim(['user_id' => null, 'ip_hash' => 'b'], '2026-10-18 10:00:00'));
        // O visitante não trava o membro, nem o contrário.
        self::assertTrue($this->claim(['user_id' => 5, 'ip_hash' => null], '2026-10-18 10:00:00'));
    }

    /**
     * A outra aba leu o `viewed_at` antigo, mas a primeira já o avançou: o
     * UPDATE condicional não acha mais a linha e não conta duas vezes.
     */
    public function test_aba_atrasada_nao_conta_em_dobro(): void
    {
        $member = ['user_id' => 5, 'ip_hash' => null];
        $this->claim($member, '2026-10-18 09:00:00');

        self::assertTrue($this->claim($member, '2026-10-18 18:00:00'));

        $stale = $this->db->table(TopicViewRecorder::TABLE)
            ->where('discussion_id', 1)->where('user_id', 5)
            ->where('viewed_at', Carbon::parse('2026-10-18 09:00:00'))
            ->update(['viewed_at' => Carbon::parse('2026-10-18 18:00:00')]);

        self::assertSame(0, $stale);
        self::assertSame(1, $this->db->table(TopicViewRecorder::TABLE)->count());
    }
}
