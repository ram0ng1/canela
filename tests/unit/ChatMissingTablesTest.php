<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\ServerRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\NullLogger;
use Ramon\Canela\Chat\Http\MissingChatTables;
use Ramon\Canela\Support\Log;

/**
 * O chat atualizado antes do `migrate`: a tabela do chat que falta vira 404
 * nas rotas do chat (o chat some, sem erro 500). Fora delas, ou com outro
 * erro de banco, o erro segue como é.
 */
final class ChatMissingTablesTest extends TestCase
{
    #[\Override]
    protected function setUp(): void
    {
        Log::use(new NullLogger());
    }

    #[\Override]
    protected function tearDown(): void
    {
        Log::use(null);
    }

    private static function failing(string $code, string $table): RequestHandlerInterface
    {
        return new class ($code, $table) implements RequestHandlerInterface {
            public function __construct(private readonly string $code, private readonly string $table)
            {
            }

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                $pdo = new \PDOException("no such table: $this->table");
                (new \ReflectionProperty(\Exception::class, 'code'))->setValue($pdo, $this->code);

                throw new QueryException('mysql', "select * from $this->table", [], $pdo);
            }
        };
    }

    /** @return iterable<string, array{string}> */
    public static function chatRoutes(): iterable
    {
        yield 'canais' => ['/api/chat-channels/state'];
        yield 'mensagens' => ['/api/chat-messages'];
        yield 'fios' => ['/api/chat-threads/3'];
        yield 'imagens' => ['/api/chat/uploads'];
        yield 'pessoas' => ['/api/users/canela-chat-search'];
    }

    #[DataProvider('chatRoutes')]
    public function test_tabela_do_chat_que_falta_vira_404(string $path): void
    {
        $this->expectException(ModelNotFoundException::class);

        (new MissingChatTables())->process(new ServerRequest([], [], $path), self::failing('42S02', 'flarum_canela_chat_channels'));
    }

    public function test_coluna_que_falta_no_postgresql_tambem(): void
    {
        $this->expectException(ModelNotFoundException::class);

        (new MissingChatTables())->process(new ServerRequest([], [], '/api/chat-messages/1'), self::failing('42703', 'canela_chat_messages'));
    }

    public function test_fora_do_chat_o_erro_segue(): void
    {
        $this->expectException(QueryException::class);

        (new MissingChatTables())->process(new ServerRequest([], [], '/api/discussions'), self::failing('42S02', 'canela_chat_channels'));
    }

    public function test_outra_tabela_que_falta_segue(): void
    {
        $this->expectException(QueryException::class);

        (new MissingChatTables())->process(new ServerRequest([], [], '/api/chat-channels'), self::failing('42S02', 'tags'));
    }

    public function test_outro_erro_de_banco_segue(): void
    {
        $this->expectException(QueryException::class);

        (new MissingChatTables())->process(new ServerRequest([], [], '/api/chat-channels'), self::failing('23000', 'canela_chat_channels'));
    }

    public function test_sem_erro_passa_a_resposta(): void
    {
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return new EmptyResponse(204);
            }
        };

        self::assertSame(204, (new MissingChatTables())->process(new ServerRequest([], [], '/api/chat-channels'), $handler)->getStatusCode());
    }
}
