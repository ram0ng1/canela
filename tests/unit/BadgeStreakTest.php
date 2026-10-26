<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Badges\BadgeQueries;

/** Dias seguidos de visita (Entusiasta, Aficionado, Devoto). */
final class BadgeStreakTest extends TestCase
{
    private string $timezone;

    protected function setUp(): void
    {
        $this->timezone = date_default_timezone_get();
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->timezone);
    }

    public function test_sequencia_completa_no_dia_certo(): void
    {
        $dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

        self::assertSame('2026-10-03', BadgeQueries::streakCompletedOn($dates, 3));
        self::assertNull(BadgeQueries::streakCompletedOn($dates, 5));
    }

    public function test_um_dia_de_folga_recomeca_a_contagem(): void
    {
        $dates = ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06'];

        self::assertSame('2026-10-06', BadgeQueries::streakCompletedOn($dates, 3));
    }

    public function test_virada_de_mes_e_de_ano(): void
    {
        self::assertSame('2027-01-01', BadgeQueries::streakCompletedOn(['2026-12-30', '2026-12-31', '2027-01-01'], 3));
    }

    /**
     * Com fuso de horário de verão, duas meias-noites seguidas podem distar
     * 23 h: a conta por diferença em dias quebrava a sequência ali.
     */
    public function test_horario_de_verao_nao_quebra_a_sequencia(): void
    {
        date_default_timezone_set('America/New_York');

        // O horário de verão de 2026 começa em 8 de março nos EUA.
        self::assertSame('2026-03-09', BadgeQueries::streakCompletedOn(['2026-03-07', '2026-03-08', '2026-03-09'], 3));
    }

    public function test_aceita_datas_com_hora(): void
    {
        self::assertSame('2026-10-02', BadgeQueries::streakCompletedOn(['2026-10-01 00:00:00', '2026-10-02 00:00:00'], 2));
    }
}
