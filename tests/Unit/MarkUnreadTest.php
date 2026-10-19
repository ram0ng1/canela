<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicCounter;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;
use Ramon\Canela\Topic\MarkUnread;

/**
 * "Marcar não lido" depois de "marcar tudo como lido": o tópico volta para o
 * filtro "Não lidos" (com `CANELA_TEST_DB=pgsql`, também no PostgreSQL).
 */
final class MarkUnreadTest extends TestCase
{
    private Connection $db;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $resolver = new ConnectionResolver(['default' => $this->db]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);

        $schema = $this->db->getSchemaBuilder();
        $schema->dropIfExists('discussion_user');
        $schema->dropIfExists('discussions');
        $schema->create('discussions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('last_post_number')->nullable();
            $table->dateTime('last_posted_at')->nullable();
        });
        $schema->create('discussion_user', static function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('discussion_id');
            $table->unsignedInteger('last_read_post_number')->nullable();
            $table->dateTime(MarkUnread::COLUMN)->nullable();
        });

        // 1: respondido depois de "marcar tudo"; 2: antigo, marcado como não lido
        // depois de "marcar tudo"; 3: antigo, marcado como não lido antes dele.
        $this->db->table('discussions')->insert([
            ['id' => 1, 'last_post_number' => 4, 'last_posted_at' => '2026-10-19 12:00:00'],
            ['id' => 2, 'last_post_number' => 4, 'last_posted_at' => '2026-10-18 12:00:00'],
            ['id' => 3, 'last_post_number' => 4, 'last_posted_at' => '2026-10-18 12:00:00'],
        ]);
        $this->db->table('discussion_user')->insert([
            ['user_id' => 7, 'discussion_id' => 1, 'last_read_post_number' => 3, MarkUnread::COLUMN => null],
            ['user_id' => 7, 'discussion_id' => 2, 'last_read_post_number' => 3, MarkUnread::COLUMN => '2026-10-19 10:00:00'],
            ['user_id' => 7, 'discussion_id' => 3, 'last_read_post_number' => 3, MarkUnread::COLUMN => '2026-10-17 10:00:00'],
        ]);
    }

    protected function tearDown(): void
    {
        $schema = $this->db->getSchemaBuilder();
        $schema->dropIfExists('discussion_user');
        $schema->dropIfExists('discussions');
        Model::unsetConnectionResolver();
    }

    /** @return list<int> */
    private function unreadIds(bool $schemaReady): array
    {
        $settings = new ArraySettings($schemaReady ? [MarkUnread::SCHEMA => '1'] : []);
        $counter = new TopicCounter(new StatsSettings($settings), $this->createStub(ExtensionManager::class), $settings);

        $actor = new User();
        $actor->id = 7;
        $actor->marked_all_as_read_at = Carbon::parse('2026-10-18 18:00:00');

        $query = Discussion::query();
        $counter->constrainUnread($query, $actor);

        return $query->orderBy('discussions.id')->pluck('discussions.id')->map(static fn ($id): int => (int) $id)->all();
    }

    public function test_marcado_como_nao_lido_depois_de_marcar_tudo_volta(): void
    {
        self::assertSame([1, 2], $this->unreadIds(true));
    }

    public function test_sem_a_migracao_fica_a_regra_do_core(): void
    {
        self::assertSame([1], $this->unreadIds(false));
    }
}
