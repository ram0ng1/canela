<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Revised;
use Flarum\User\User;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\DatabaseTransactionsManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Events\Dispatcher;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Ramon\Canela\Badges\SingleGrantLock;
use Ramon\Canela\Badges\UserBadge;
use Ramon\Canela\Extras\Extras;
use Ramon\Canela\Extras\History\PostRevision;
use Ramon\Canela\Extras\History\RecordRevision;
use Ramon\Canela\Messages\Reactions\MessageReactions;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\Sqlite;

/**
 * Escritas simultâneas que davam erro 500 ou duplicavam linhas. A "outra
 * requisição" é simulada logo depois da leitura (um ouvinte de consulta grava
 * a linha concorrente entre o SELECT e o INSERT), que é a janela da corrida.
 */
final class ConcurrentWritesTest extends TestCase
{
    private SQLiteConnection $db;

    protected function setUp(): void
    {
        $this->db = Sqlite::connection();
        $this->db->setEventDispatcher(new Dispatcher());
        $resolver = new ConnectionResolver(['default' => $this->db]);
        $resolver->setDefaultConnection('default');
        Model::setConnectionResolver($resolver);
    }

    protected function tearDown(): void
    {
        Model::unsetConnectionResolver();
    }

    /** Roda `$write` uma vez, logo depois da primeira consulta que casar com `$pattern`. */
    private function afterFirstQuery(string $pattern, callable $write): void
    {
        $done = false;
        $this->db->listen(function (QueryExecuted $query) use (&$done, $pattern, $write): void {
            if (! $done && preg_match($pattern, $query->sql)) {
                $done = true;
                $write();
            }
        });
    }

    private function userBadgesTable(): void
    {
        $this->db->getSchemaBuilder()->create('canela_user_badges', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('badge_id');
            $table->unsignedInteger('post_id')->nullable();
            $table->dateTime('granted_at');
            $table->unique(['badge_id', 'user_id', 'post_id']);
        });
    }

    private function grant(int $badgeId, int $userId, ?int $postId): UserBadge
    {
        $userBadge = new UserBadge();
        $userBadge->badge_id = $badgeId;
        $userBadge->user_id = $userId;
        $userBadge->post_id = $postId;
        $userBadge->granted_at = Carbon::now();

        return $userBadge;
    }

    public function test_emblema_unico_nao_duplica_com_post_diferente(): void
    {
        $this->userBadgesTable();
        $lock = new SingleGrantLock(new Repository(new ArrayStore()), waitSeconds: 0);

        // O índice único sozinho deixaria passar: o post (ou o NULL) muda.
        self::assertTrue($lock->save($this->grant(1, 5, 10)));
        self::assertFalse($lock->save($this->grant(1, 5, 11)));
        self::assertFalse($lock->save($this->grant(1, 5, null)));
        self::assertTrue($lock->save($this->grant(1, 6, null)));

        self::assertSame(1, $this->db->table('canela_user_badges')->where('badge_id', 1)->where('user_id', 5)->count());
    }

    public function test_emblema_unico_concedido_por_outro_processo_no_meio(): void
    {
        $this->userBadgesTable();
        $cache = new Repository(new ArrayStore());
        $lock = new SingleGrantLock($cache, waitSeconds: 0);

        // Outro processo segura a trava (está gravando a mesma concessão): este desiste.
        $other = $cache->getStore()->lock('canela.badge-grant.1.5', 10);
        self::assertTrue($other->get());
        self::assertFalse($lock->save($this->grant(1, 5, 10)));
        $other->release();

        self::assertTrue($lock->save($this->grant(1, 5, 10)));
    }

    public function test_trava_do_emblema_so_sai_depois_do_commit(): void
    {
        $this->userBadgesTable();
        $this->db->setTransactionManager(new DatabaseTransactionsManager());
        $cache = new Repository(new ArrayStore());
        $lock = new SingleGrantLock($cache, waitSeconds: 0);

        $this->db->transaction(function () use ($lock, $cache): void {
            self::assertTrue($lock->save($this->grant(1, 5, 10)));

            // Antes do commit a linha nova é invisível para os outros: a trava continua.
            self::assertFalse($cache->getStore()->lock('canela.badge-grant.1.5', 10)->get());
        });

        self::assertTrue($cache->getStore()->lock('canela.badge-grant.1.5', 10)->get());
    }

    public function test_duas_edicoes_ao_mesmo_tempo_guardam_as_duas_versoes(): void
    {
        $this->db->getSchemaBuilder()->create('canela_post_revisions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('revision');
            $table->mediumText('content');
            $table->dateTime('created_at');
            $table->unique(['post_id', 'revision']);
        });

        // A outra edição grava a versão 1 depois que esta leu o último número (0).
        $this->afterFirstQuery('/max\(.revision.\)/i', fn () => $this->db->table('canela_post_revisions')->insert([
            'post_id' => 7, 'user_id' => 3, 'revision' => 1, 'content' => 'versão da outra aba', 'created_at' => '2026-10-18 10:00:00',
        ]));

        $post = new CommentPost();
        $post->id = 7;
        $post->edited_at = Carbon::parse('2026-10-18 10:00:01');
        $actor = new User();
        $actor->id = 2;

        (new RecordRevision(new ArraySettings([Extras::POST_HISTORY => '1']), new NullLogger()))
            ->handle(new Revised($post, $actor, 'versão anterior'));

        self::assertSame(
            [1 => 'versão da outra aba', 2 => 'versão anterior'],
            PostRevision::query()->where('post_id', 7)->orderBy('revision')->pluck('content', 'revision')->all()
        );
    }

    /** @return array<string, array{string}> */
    public static function reactionWindows(): array
    {
        return [
            // Depois de ler a reação atual da pessoa.
            'depois da leitura' => ['/^select .*reaction/i'],
            // Entre o "existe?" e o INSERT do antigo updateOrInsert: a corrida que dava 500.
            'entre conferir e inserir' => ['/select exists/i'],
        ];
    }

    #[DataProvider('reactionWindows')]
    public function test_duas_reacoes_ao_mesmo_tempo_nao_dao_erro(string $window): void
    {
        $this->db->getSchemaBuilder()->create(MessageReactions::TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('message_id');
            $table->unsignedInteger('user_id');
            $table->string('reaction', 100);
            $table->dateTime('created_at')->nullable();
            $table->unique(['message_id', 'user_id']);
        });

        $extensions = $this->createStub(ExtensionManager::class);
        $extensions->method('isEnabled')->willReturn(false);
        $reactions = new MessageReactions($this->db, $extensions);
        $actor = new User();
        $actor->id = 4;

        // A outra aba grava a reação dela depois que esta conferiu que não havia nenhuma.
        $this->afterFirstQuery($window, fn () => $this->db->table(MessageReactions::TABLE)->insert([
            'message_id' => 9, 'user_id' => 4, 'reaction' => 'heart', 'created_at' => '2026-10-18 10:00:00',
        ]));

        self::assertTrue($reactions->react(9, $actor, 'tada'));

        // Vale a última, uma linha só.
        self::assertSame(['tada'], $this->db->table(MessageReactions::TABLE)->where('message_id', 9)->pluck('reaction')->all());
        self::assertFalse($reactions->react(9, $actor, 'tada'));
    }
}
