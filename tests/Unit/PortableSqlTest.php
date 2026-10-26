<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Carbon\Carbon;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Revised;
use Flarum\User\User;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\DatabaseTransactionsManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\UsageLimiter;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatNotifier;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Notification\ChatMentionBlueprint;
use Ramon\Canela\Extras\Extras;
use Ramon\Canela\Extras\History\PostRevision;
use Ramon\Canela\Extras\History\RecordRevision;
use Ramon\Canela\Messages\Api\UserFields;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Stats\TopicViewStats;
use Ramon\Canela\Support\NullOrder;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/**
 * O SQL que só o PostgreSQL recusa (ou lê diferente). No SQLite padrão estes
 * testes passam de qualquer jeito; com `CANELA_TEST_DB=pgsql` (o job do
 * PostgreSQL na CI) eles pegam a volta de cada um desses erros.
 */
final class PortableSqlTest extends TestCase
{
    private Connection $db;

    protected function setUp(): void
    {
        $this->db = TestDatabase::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $resolver = new ConnectionResolver(['default' => $this->db]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);
    }

    protected function tearDown(): void
    {
        Model::unsetConnectionResolver();
        Carbon::setTestNow();
    }

    /** `"x" = x + 1` no ON CONFLICT DO UPDATE é coluna ambígua no PostgreSQL. */
    public function test_upsert_soma_no_contador_existente(): void
    {
        $this->db->getSchemaBuilder()->create(TopicViewStats::TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('discussion_id');
            $table->date('date');
            $table->unsignedInteger('anonymous_views')->default(0);
            $table->unsignedInteger('logged_in_views')->default(0);
            $table->unique(['discussion_id', 'date']);
        });

        $stats = new TopicViewStats($this->db);
        (fn () => $this->available = true)->call($stats);
        $day = Carbon::parse('2026-10-18');

        $stats->add(3, $day, false);
        $stats->add(3, $day, true);
        $stats->add(3, $day, true);

        $row = $this->db->table(TopicViewStats::TABLE)->where('discussion_id', 3)->first();
        self::assertSame([1, 2], [(int) $row->anonymous_views, (int) $row->logged_in_views]);
    }

    public function test_upsert_do_limite_de_ia(): void
    {
        Carbon::setTestNow('2026-10-18 12:00:00');
        $this->db->getSchemaBuilder()->create('canela_ai_usage', static function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->date('day');
            $table->unsignedInteger('requests')->default(0);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->primary(['user_id', 'day']);
        });

        $limiter = new UsageLimiter(new AiSettings(new ArraySettings([AiSettings::DAILY_LIMIT => '5'])), $this->db);
        $actor = new User();
        $actor->id = 8;
        // Sem grupos: não é administrador (o limite vale).
        $actor->setRelation('groups', $actor->newCollection());

        $limiter->countRequest($actor);
        $limiter->countRequest($actor);
        $limiter->addTokens($actor, 10, 4);

        self::assertSame(3, $limiter->remaining($actor));
        self::assertSame(14, (int) $this->db->table('canela_ai_usage')->selectRaw('input_tokens + output_tokens as total')->value('total'));
    }

    /** O claim confere e gasta num UPDATE só: passa até o limite e para nele. */
    public function test_claim_do_limite_de_ia_para_no_limite(): void
    {
        Carbon::setTestNow('2026-10-18 12:00:00');
        $this->db->getSchemaBuilder()->create('canela_ai_usage', static function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->date('day');
            $table->unsignedInteger('requests')->default(0);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->primary(['user_id', 'day']);
        });

        $limiter = new UsageLimiter(new AiSettings(new ArraySettings([AiSettings::DAILY_LIMIT => '2'])), $this->db);
        $actor = new User();
        $actor->id = 9;
        $actor->setRelation('groups', $actor->newCollection());

        self::assertTrue($limiter->claim($actor));
        self::assertTrue($limiter->claim($actor));
        self::assertFalse($limiter->claim($actor));
        self::assertSame(2, (int) $this->db->table('canela_ai_usage')->where('user_id', 9)->value('requests'));
    }

    /** `canela_via_group` é boolean: no PostgreSQL, `boolean = 0` não existe. */
    public function test_contagem_de_mensagens_com_caixas_de_grupo(): void
    {
        $schema = $this->db->getSchemaBuilder();
        $schema->create(MessagesSchema::DIALOG_TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('last_message_id')->nullable();
            $table->unsignedInteger(MessagesSchema::GROUP_COLUMN)->nullable();
        });
        $schema->create(MessagesSchema::STATE_TABLE, static function (Blueprint $table): void {
            $table->unsignedInteger('dialog_id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('last_read_message_id')->default(0);
            $table->dateTime(MessagesSchema::ARCHIVED_COLUMN)->nullable();
            $table->boolean(MessagesSchema::VIA_GROUP_COLUMN)->default(false);
            $table->string(MessagesSchema::LEVEL_COLUMN, 20)->nullable();
        });

        $this->db->table(MessagesSchema::DIALOG_TABLE)->insert([['id' => 1, 'last_message_id' => 10], ['id' => 2, 'last_message_id' => 20], ['id' => 3, 'last_message_id' => 30]]);
        $this->db->table(MessagesSchema::STATE_TABLE)->insert([
            ['dialog_id' => 1, 'user_id' => 5, 'last_read_message_id' => 0, MessagesSchema::VIA_GROUP_COLUMN => false],
            ['dialog_id' => 2, 'user_id' => 5, 'last_read_message_id' => 15, MessagesSchema::VIA_GROUP_COLUMN => false],
            ['dialog_id' => 3, 'user_id' => 5, 'last_read_message_id' => 0, MessagesSchema::VIA_GROUP_COLUMN => true],
        ]);

        $columns = new \ReflectionProperty(MessagesSchema::class, 'columns');
        $before = $columns->getValue();
        $columns->setValue(null, array_fill_keys(array_map(
            static fn (array $c) => implode('.', $c),
            [
                [MessagesSchema::STATE_TABLE, MessagesSchema::ARCHIVED_COLUMN],
                [MessagesSchema::DIALOG_TABLE, MessagesSchema::GROUP_COLUMN],
                [MessagesSchema::STATE_TABLE, MessagesSchema::VIA_GROUP_COLUMN],
                [MessagesSchema::STATE_TABLE, MessagesSchema::LEVEL_COLUMN],
            ]
        ), true));

        try {
            $user = new User();
            $user->id = 5;
            $fields = new UserFields($this->db);

            self::assertSame(['new' => 1, 'unread' => 1, 'group' => 1], (fn () => $this->count($user))->call($fields));
        } finally {
            $columns->setValue(null, $before);
        }
    }

    /**
     * Dentro da transação da edição: no PostgreSQL o erro do índice único aborta
     * a transação inteira, e a nova tentativa só passa com o SAVEPOINT.
     */
    public function test_versao_da_postagem_dentro_de_uma_transacao(): void
    {
        $this->db->setTransactionManager(new DatabaseTransactionsManager());
        $this->db->getSchemaBuilder()->create('canela_post_revisions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('revision');
            $table->mediumText('content');
            $table->dateTime('created_at');
            $table->unique(['post_id', 'revision']);
        });

        $done = false;
        $this->db->listen(function (QueryExecuted $query) use (&$done): void {
            if (! $done && preg_match('/max\(.revision.\)/i', $query->sql)) {
                $done = true;
                $this->db->table('canela_post_revisions')->insert([
                    'post_id' => 7, 'user_id' => 3, 'revision' => 1, 'content' => 'versão da outra aba', 'created_at' => '2026-10-18 10:00:00',
                ]);
            }
        });

        $post = new CommentPost();
        $post->id = 7;
        $post->edited_at = Carbon::parse('2026-10-18 10:00:01');
        $actor = new User();
        $actor->id = 2;

        $this->db->transaction(static function () use ($post, $actor): void {
            (new RecordRevision(new ArraySettings([Extras::POST_HISTORY => '1']), new NullLogger()))
                ->handle(new Revised($post, $actor, 'versão anterior'));
        });

        self::assertSame(
            [1 => 'versão da outra aba', 2 => 'versão anterior'],
            PostRevision::query()->where('post_id', 7)->orderBy('revision')->pluck('content', 'revision')->all()
        );
    }

    /** O PostgreSQL põe o NULL por último no `asc`; os outros, primeiro. */
    public function test_null_conta_como_o_menor_valor(): void
    {
        $this->db->getSchemaBuilder()->create('canela_null_order', static function (Blueprint $table): void {
            $table->unsignedInteger('id');
            $table->dateTime('seen_at')->nullable();
        });
        $this->db->table('canela_null_order')->insert([
            ['id' => 1, 'seen_at' => '2026-10-01 00:00:00'],
            ['id' => 2, 'seen_at' => null],
            ['id' => 3, 'seen_at' => '2026-10-05 00:00:00'],
        ]);

        $ids = function (string $direction): array {
            $query = $this->db->table('canela_null_order');
            NullOrder::orderBy($query, 'seen_at', $direction);

            return $query->pluck('id')->map('intval')->all();
        };

        self::assertSame([2, 1, 3], $ids('asc'));
        self::assertSame([3, 1, 2], $ids('desc'));
    }

    /** `notifications.data` é JSON: o filtro vai pelo caminho, não pelo texto. */
    public function test_ler_o_canal_marca_as_notificacoes_dele(): void
    {
        $this->db->getSchemaBuilder()->create('canela_chat_mentions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('message_id');
            $table->unsignedInteger('user_id');
        });
        $this->db->getSchemaBuilder()->create('notifications', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('from_user_id')->nullable();
            $table->string('type', 100);
            $table->string('subject_id')->nullable();
            $table->json('data')->nullable();
            $table->dateTime('created_at');
            $table->dateTime('read_at')->nullable();
            $table->boolean('is_deleted')->default(false);
        });

        // Com espaço depois dos dois-pontos, como o MySQL guarda uma coluna JSON.
        $row = static fn (int $user, int $channel, int $message) => [
            'user_id' => $user, 'type' => ChatMentionBlueprint::TYPE, 'created_at' => '2026-10-18 10:00:00',
            'data' => '{"channelId": '.$channel.', "messageId": '.$message.', "excerpt": "oi"}',
        ];
        $this->db->table('notifications')->insert([$row(5, 1, 10), $row(5, 1, 11), $row(5, 12, 40), $row(6, 1, 10)]);

        $notifier = new ChatNotifier($this->createStub(NotificationSyncer::class), (new \ReflectionClass(ChatAccess::class))->newInstanceWithoutConstructor());
        $user = new User();
        $user->id = 5;
        $channel = new Channel();
        $channel->id = 1;

        $notifier->markChannelRead($channel, $user);

        self::assertSame([1, 2], $this->db->table('notifications')->whereNotNull('read_at')->orderBy('id')->pluck('id')->map('intval')->all());

        $message = new Message();
        $message->id = 10;
        $message->channel_id = 1;
        $notifier->forgetMessage($message);

        self::assertSame([1, 4], $this->db->table('notifications')->where('is_deleted', true)->orderBy('id')->pluck('id')->map('intval')->all());
    }
}
