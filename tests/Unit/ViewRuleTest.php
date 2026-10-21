<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Carbon\Carbon;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Stats\ViewRule;

/** A regra de visualização: uma por dia, travada por N horas. */
final class ViewRuleTest extends TestCase
{
    public function test_primeira_visualizacao_conta(): void
    {
        self::assertTrue(ViewRule::countsAgain(null, Carbon::parse('2026-10-18 10:00:00'), 8));
    }

    public function test_dentro_da_janela_no_mesmo_dia_nao_conta(): void
    {
        self::assertFalse(ViewRule::countsAgain(Carbon::parse('2026-10-18 10:00:00'), Carbon::parse('2026-10-18 17:59:59'), 8));
    }

    public function test_depois_da_janela_conta(): void
    {
        self::assertTrue(ViewRule::countsAgain(Carbon::parse('2026-10-18 10:00:00'), Carbon::parse('2026-10-18 18:00:00'), 8));
    }

    public function test_dia_novo_conta_mesmo_dentro_da_janela(): void
    {
        self::assertTrue(ViewRule::countsAgain(Carbon::parse('2026-10-18 23:59:00'), Carbon::parse('2026-10-19 00:01:00'), 8));
    }

    /** As mensagens privadas guardam a trava no cache: a chave leva o dia. */
    public function test_chave_do_cache_muda_com_o_dia(): void
    {
        $before = ViewRule::cacheKey('dialog', 7, Carbon::parse('2026-10-18 23:59:00'), '3');
        $after = ViewRule::cacheKey('dialog', 7, Carbon::parse('2026-10-19 00:01:00'), '3');

        self::assertSame('canela.view.dialog.7.2026-10-18.3', $before);
        self::assertNotSame($before, $after);
        self::assertNotSame($before, ViewRule::cacheKey('dialog', 7, Carbon::parse('2026-10-18 12:00:00'), '4'));
    }
}
