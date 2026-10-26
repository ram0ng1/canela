<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Flarum\User\User;
use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\UnreadCounter;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * As não lidas do chat são contadas a cada consulta de estado (a cada 15 s
 * por aba): cada canal e cada fio para em CAP, e conta só o que vem depois
 * da última lida, de outra pessoa e não apagado.
 */
final class ChatUnreadCounterTest extends TestCase
{
    private const ME = 7;

    private Connection $db;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $schema = $this->db->getSchemaBuilder();

        $schema->create('canela_chat_channels', static function (Blueprint $t): void {
            $t->increments('id');
            $t->boolean('threading_enabled')->default(true);
        });
        $schema->create('canela_chat_messages', static function (Blueprint $t): void {
            $t->increments('id');
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('thread_id')->nullable();
            $t->unsignedInteger('user_id')->nullable();
            $t->dateTime('deleted_at')->nullable();
            $t->index(['channel_id', 'id']);
            $t->index(['thread_id', 'id']);
        });
        $schema->create('canela_chat_memberships', static function (Blueprint $t): void {
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('last_read_message_id')->nullable();
            $t->dateTime('last_viewed_pins_at')->nullable();
        });
        $schema->create('canela_chat_threads', static function (Blueprint $t): void {
            $t->increments('id');
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('original_message_id');
            $t->unsignedInteger('replies_count')->default(0);
            $t->unsignedInteger('last_message_id')->nullable();
        });
        $schema->create('canela_chat_thread_memberships', static function (Blueprint $t): void {
            $t->unsignedInteger('thread_id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('last_read_message_id')->nullable();
            $t->unsignedTinyInteger('notification_level')->default(2);
        });
        $schema->create('canela_chat_mentions', static function (Blueprint $t): void {
            $t->unsignedInteger('message_id');
            $t->unsignedInteger('user_id');
        });
        $schema->create('canela_chat_pins', static function (Blueprint $t): void {
            $t->unsignedInteger('channel_id');
            $t->unsignedInteger('pinned_by_id')->nullable();
            $t->dateTime('created_at')->nullable();
        });
    }

    private function counter(bool $threads = true): UnreadCounter
    {
        return new UnreadCounter($this->db, new ChatSettings(new ArraySettings([ChatSettings::THREADS_ENABLED => $threads ? '1' : '0'])));
    }

    private function actor(): User
    {
        $user = new User();
        $user->id = self::ME;

        return $user;
    }

    /** @return list<int> os ids das mensagens criadas */
    private function messages(int $channel, int $count, array $extra = []): array
    {
        $ids = [];

        for ($i = 0; $i < $count; $i++) {
            $ids[] = (int) $this->db->table('canela_chat_messages')->insertGetId($extra + ['channel_id' => $channel, 'user_id' => 1]);
        }

        return $ids;
    }

    public function test_canal_nunca_lido_para_no_teto(): void
    {
        $this->db->table('canela_chat_channels')->insert([['id' => 1], ['id' => 2]]);
        $this->messages(1, UnreadCounter::CAP + 60);
        $this->db->table('canela_chat_memberships')->insert(['channel_id' => 1, 'user_id' => self::ME, 'last_read_message_id' => null]);

        $counts = $this->counter()->forUser($this->actor(), [1, 2]);

        self::assertSame(UnreadCounter::CAP, $counts[1]['unread']);
        self::assertSame(0, $counts[2]['unread'], 'sem ser membro, nada conta');
    }

    public function test_conta_so_depois_da_ultima_lida_de_outra_pessoa_e_nao_apagada(): void
    {
        $this->db->table('canela_chat_channels')->insert(['id' => 1]);
        $read = $this->messages(1, 5);
        $this->messages(1, 2);
        $this->messages(1, 1, ['user_id' => self::ME]);
        $this->messages(1, 1, ['deleted_at' => '2026-10-26 00:00:00']);
        $this->db->table('canela_chat_memberships')->insert(['channel_id' => 1, 'user_id' => self::ME, 'last_read_message_id' => end($read)]);

        self::assertSame(2, $this->counter()->forUser($this->actor(), [1])[1]['unread']);
    }

    public function test_respostas_de_fio_contam_no_fio_e_param_no_teto(): void
    {
        $this->db->table('canela_chat_channels')->insert(['id' => 1]);
        [$original] = $this->messages(1, 1);
        $this->db->table('canela_chat_threads')->insert(['id' => 9, 'channel_id' => 1, 'original_message_id' => $original]);
        $this->db->table('canela_chat_messages')->where('id', $original)->update(['thread_id' => 9]);
        $replies = $this->messages(1, UnreadCounter::CAP + 20, ['thread_id' => 9]);
        $this->db->table('canela_chat_memberships')->insert(['channel_id' => 1, 'user_id' => self::ME, 'last_read_message_id' => null]);
        $this->db->table('canela_chat_thread_memberships')->insert(['thread_id' => 9, 'user_id' => self::ME, 'last_read_message_id' => $replies[10]]);

        $counter = $this->counter();

        self::assertSame(1, $counter->forUser($this->actor(), [1])[1]['unread'], 'só a original fica na conversa principal');
        self::assertSame([9 => UnreadCounter::CAP], $counter->threadUnread($this->actor(), [9]));
        self::assertSame([], $counter->threadUnread($this->actor(), [10]), 'fio sem participação não conta');
    }

    public function test_com_fios_desligados_tudo_conta_no_canal(): void
    {
        $this->db->table('canela_chat_channels')->insert(['id' => 1]);
        [$original] = $this->messages(1, 1);
        $this->db->table('canela_chat_threads')->insert(['id' => 9, 'channel_id' => 1, 'original_message_id' => $original]);
        $this->messages(1, 3, ['thread_id' => 9]);
        $this->db->table('canela_chat_memberships')->insert(['channel_id' => 1, 'user_id' => self::ME]);

        self::assertSame(4, $this->counter(false)->forUser($this->actor(), [1])[1]['unread']);
    }
}
