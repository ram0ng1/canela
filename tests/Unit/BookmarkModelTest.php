<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Carbon\Carbon;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * O lembrete do marcador: trocar a hora rearma o envio; salvar a mesma hora
 * (o formulário manda tudo de novo) não manda o lembrete outra vez.
 */
final class BookmarkModelTest extends TestCase
{
    protected function setUp(): void
    {
        // Só para o Eloquent saber o formato de data do banco.
        $resolver = new ConnectionResolver(['default' => TestDatabase::connection()]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);
    }

    protected function tearDown(): void
    {
        Model::unsetConnectionResolver();
    }

    public function test_lembrete_em_utc_e_no_minuto(): void
    {
        $bookmark = new Bookmark();
        $bookmark->setReminder(Carbon::parse('2026-10-20 09:30:45', 'America/Sao_Paulo'));

        self::assertSame('2026-10-20 12:30:00', $bookmark->reminder_at->utc()->toDateTimeString());
    }

    public function test_mesma_hora_nao_rearma(): void
    {
        $bookmark = new Bookmark();
        $bookmark->setReminder(Carbon::parse('2026-10-20 12:30:00', 'UTC'));
        $bookmark->reminded_at = Carbon::parse('2026-10-20 12:31:00', 'UTC');

        $bookmark->setReminder(Carbon::parse('2026-10-20 12:30:59', 'UTC'));
        self::assertNotNull($bookmark->reminded_at);

        $bookmark->setReminder(Carbon::parse('2026-10-21 08:00:00', 'UTC'));
        self::assertNull($bookmark->reminded_at);

        $bookmark->reminded_at = Carbon::parse('2026-10-21 08:01:00', 'UTC');
        $bookmark->setReminder(null);
        self::assertNull($bookmark->reminder_at);
        self::assertNull($bookmark->reminded_at);
    }

    public function test_nome_aparado_e_limitado(): void
    {
        $bookmark = new Bookmark();

        $bookmark->setName('   ');
        self::assertNull($bookmark->name);

        $bookmark->setName('  ler depois  ');
        self::assertSame('ler depois', $bookmark->name);

        $bookmark->setName(str_repeat('á', Bookmark::NAME_MAX_LENGTH + 20));
        self::assertSame(Bookmark::NAME_MAX_LENGTH, mb_strlen((string) $bookmark->name));
    }
}
