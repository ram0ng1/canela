<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\System;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Messages\DialogMessage\Event\Created;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use Ramon\Canela\System\Messages\MessageSender;

/**
 * As mensagens automáticas ligadas à moderação:
 *
 * - "post denunciado removido" só com denúncias da comunidade (`type =
 *   'user'`), nunca pelas do flarum/approval ou de antispam, e sem o texto
 *   livre de quem denunciou;
 * - a "primeira postagem" é a primeira visível: o post retido pela aprovação
 *   não conta até ser aprovado, e então conta, uma vez só;
 * - o aviso da mensagem nova (`Created`) sai depois do commit.
 *
 * O sistema é a conta 5. normal (2) tem o post 2 na discussão 1.
 */
class AutoMessagesModerationTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** O nível de transação em que cada `Created` foi ouvido. */
    public static array $createdLevels = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-messages', 'flarum-flags', 'flarum-approval', 'ramon-canela');

        $this->setting('canela.system_user_id', '5');
        $this->setting('canela.system_messages_schema', '1');

        self::$createdLevels = [];

        $this->extend(
            (new Extend\Event())->listen(Created::class, static function (): void {
                self::$createdLevels[] = resolve(ConnectionInterface::class)->transactionLevel();
            })
        );

        $past = Carbon::now()->subHours(2);

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'alice', 'email' => 'alice@machine.local', 'is_email_confirmed' => 1],
                ['id' => 5, 'username' => 'system', 'email' => 'system-x@system.invalid', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Tópico', 'user_id' => 1, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 2, 'first_post_id' => 1, 'last_post_number' => 2],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Oi</t>', 'number' => 1, 'created_at' => $past],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Compre agora</t>', 'number' => 2, 'created_at' => $past],
            ],
        ]);
    }

    /**
     * A entrega síncrona (fila `sync`) e o flarum/flags buscam o sistema, o
     * autor e o ator pelo id mais de uma vez na mesma requisição: um número
     * fixo e pequeno, que não cresce com os dados.
     */
    protected function allowedRepeatedQueries(): array
    {
        return ['select * from "users" where "users"."id" = ? limit ?'];
    }

    private function sentTo(int $userId): array
    {
        return $this->database()->table('canela_system_messages')->where('user_id', $userId)->pluck('type')->all();
    }

    private function lastContent(int $userId): string
    {
        $id = $this->database()->table('canela_system_messages')->where('user_id', $userId)->orderByDesc('id')->value('dialog_message_id');

        return (string) $this->database()->table('dialog_messages')->where('id', $id)->value('content');
    }

    private function hide(int $postId): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/posts/$postId", [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'posts', 'id' => (string) $postId, 'attributes' => ['isHidden' => true]]],
        ]));
    }

    private function flag(int $postId, string $type, ?string $reason, ?string $detail, int $userId = 3): void
    {
        $this->database()->table('flags')->insert([
            'post_id' => $postId, 'type' => $type, 'user_id' => $userId, 'reason' => $reason, 'reason_detail' => $detail, 'created_at' => Carbon::now(),
        ]);
    }

    private function reply(string $content): ResponseInterface
    {
        $response = $this->send($this->request('POST', '/api/posts', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'posts', 'attributes' => ['content' => $content], 'relationships' => [
                'discussion' => ['data' => ['type' => 'discussions', 'id' => '1']],
            ]]],
        ]));

        // Fora da janela do limitador de postagens do core.
        $this->database()->table('posts')->where('user_id', 2)->update(['created_at' => Carbon::now()->subMinute()]);

        return $response;
    }

    private function firstPostMessage(): void
    {
        $this->setting('canela.sysmsg_custom', json_encode([[
            'id' => 'primeira', 'enabled' => true, 'trigger' => 'first_post', 'subject' => 'Parabéns',
            'body' => 'Sua primeira postagem, {username}!', 'createdAt' => Carbon::now()->toIso8601String(),
        ]]));
    }

    /**
     * Post denunciado pela comunidade e ocultado pela equipe: o autor recebe
     * o aviso com os motivos — e sem o texto livre de quem denunciou.
     */
    #[Test]
    public function denuncia_da_comunidade_avisa_sem_o_texto_de_quem_denunciou(): void
    {
        $this->setting('canela.sysmsg_flags_agreed_and_post_deleted_body', 'Motivos: {flag_reason}');
        $this->flag(2, 'user', 'spam', 'Eu, Alice, vi isto no meu e-mail');
        $this->flag(2, 'user', null, 'Texto livre do Outro');

        $response = $this->hide(2);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(['flags_agreed_and_post_deleted'], $this->sentTo(2));

        $content = $this->lastContent(2);
        // O rótulo do motivo (no idioma de quem recebe), não o texto livre.
        $this->assertStringContainsString('Motivos:', $content);
        $this->assertMatchesRegularExpression('/- spam/i', $content);
        $this->assertStringNotContainsString('Alice', $content);
        $this->assertStringNotContainsString('Texto livre', $content);
    }

    /**
     * Só a denúncia do flarum/approval (post à espera de aprovação) ou de um
     * antispam: o post não foi "denunciado pela comunidade", nada sai.
     */
    #[Test]
    public function denuncia_da_aprovacao_ou_antispam_nao_avisa(): void
    {
        $this->flag(2, 'approval', null, null, 2);
        $this->flag(2, 'akismet', null, null, 2);

        $response = $this->hide(2);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame([], $this->sentTo(2));
    }

    /**
     * A primeira postagem retida pela aprovação não manda a personalizada; ao
     * ser aprovada, manda — e a seguinte, já aprovada, não manda de novo.
     */
    #[Test]
    public function primeira_postagem_retida_conta_ao_ser_aprovada(): void
    {
        $this->firstPostMessage();

        // O post 2 do cenário não existe aqui: esta é a primeira de normal.
        $this->database()->table('posts')->where('id', 2)->delete();
        // Membros respondem só com aprovação.
        $this->database()->table('group_permission')->where('permission', 'discussion.replyWithoutApproval')->delete();

        $response = $this->reply('Primeira resposta');
        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $postId = (int) json_decode((string) $response->getBody(), true)['data']['id'];
        $this->assertFalse((bool) $this->database()->table('posts')->where('id', $postId)->value('is_approved'));
        $this->assertSame([], $this->sentTo(2));

        $approve = $this->send($this->request('PATCH', "/api/posts/$postId", [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'posts', 'id' => (string) $postId, 'attributes' => ['isApproved' => true]]],
        ]));

        $this->assertEquals(200, $approve->getStatusCode(), (string) $approve->getBody());
        $this->assertSame(['custom_primeira'], $this->sentTo(2));

        // A seguinte, já sem aprovação, não manda de novo.
        $this->database()->table('group_permission')->insert(['group_id' => 3, 'permission' => 'discussion.replyWithoutApproval']);
        $this->assertEquals(201, $this->reply('Segunda resposta')->getStatusCode());
        $this->assertSame(['custom_primeira'], $this->sentTo(2));
    }

    /**
     * Um comentário antigo oculto não conta: a primeira postagem visível é a
     * nova.
     */
    #[Test]
    public function post_oculto_nao_conta_como_primeira_postagem(): void
    {
        $this->firstPostMessage();
        $this->database()->table('posts')->where('id', 2)->update(['hidden_at' => Carbon::now()->subHour(), 'hidden_user_id' => 1]);

        $this->assertEquals(201, $this->reply('Agora sim')->getStatusCode());
        $this->assertSame(['custom_primeira'], $this->sentTo(2));
    }

    /**
     * O `Created` da mensagem automática sai fora da transação da entrega:
     * com a fila assíncrona, o trabalho do aviso acha a mensagem gravada.
     */
    #[Test]
    public function aviso_da_mensagem_sai_depois_do_commit(): void
    {
        $db = $this->database();
        $base = $db->transactionLevel();

        $sent = $this->app()->getContainer()->make(MessageSender::class)->send(User::findOrFail(2), 'welcome_user');

        $this->assertTrue($sent);
        $this->assertSame([$base], self::$createdLevels);
    }
}
