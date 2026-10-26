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
use Flarum\Messages\Dialog;
use Flarum\Messages\DialogMessage;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use Ramon\Canela\Tests\integration\api\Messages\RerunsMessagesMigrations;

/**
 * As mensagens automáticas do usuário do sistema (boas-vindas, suspensão,
 * primeira postagem) e a conversa com ele: ninguém responde nem escreve a
 * ele, e cada mensagem desligada no admin não sai.
 *
 * O sistema é a conta 5; normal (2) já tem uma conversa com ele (20).
 */
class AutoMessagesTest extends TestCase
{
    use RetrievesAuthorizedUsers;
    use RerunsMessagesMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        $this->rerunMessagesMigrations();
        $this->extension('flarum-messages', 'flarum-suspend', 'ramon-canela');

        $this->setting('canela.system_user_id', '5');
        $this->setting('canela.system_messages_schema', '1');

        $past = Carbon::now()->subHours(2);

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 5, 'username' => 'system', 'email' => 'system-x@system.invalid', 'is_email_confirmed' => 1],
            ],
            Dialog::class => [
                ['id' => 20, 'type' => 'direct', 'first_message_id' => 201, 'last_message_id' => 201, 'last_message_at' => $past, 'created_at' => $past],
            ],
            DialogMessage::class => [
                ['id' => 201, 'dialog_id' => 20, 'user_id' => 5, 'content' => '<t>Aviso</t>', 'number' => 1, 'created_at' => $past],
            ],
            'dialog_user' => [
                ['dialog_id' => 20, 'user_id' => 2, 'joined_at' => $past, 'last_read_message_id' => 0],
                ['dialog_id' => 20, 'user_id' => 5, 'joined_at' => $past, 'last_read_message_id' => 201],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Tópico', 'user_id' => 1, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 1, 'first_post_id' => 1, 'last_post_number' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Oi</t>', 'number' => 1, 'created_at' => $past],
            ],
        ]);
    }

    /**
     * A entrega síncrona (fila `sync`) busca o sistema, o destinatário e o
     * ator pelo id mais de uma vez na mesma requisição: um número fixo e
     * pequeno, que não cresce com os dados.
     */
    protected function allowedRepeatedQueries(): array
    {
        // Só o fim da consulta, para valer com prefixo de tabela, e nas duas
        // grafias: aspas (SQLite, PostgreSQL) e crases (MySQL, MariaDB).
        return [
            'users"."id" = ? limit ?',
            'users`.`id` = ? limit ?',
        ];
    }

    private function json(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    private function sentTo(int $userId): array
    {
        return $this->database()->table('canela_system_messages')->where('user_id', $userId)->pluck('type')->all();
    }

    private function createUser(): int
    {
        $response = $this->send($this->request('POST', '/api/users', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'attributes' => [
                'username' => 'novata', 'email' => 'novata@machine.local', 'password' => 'senha-bem-longa', 'isEmailConfirmed' => true,
            ]]],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        return (int) $this->json($response)['data']['id'];
    }

    /**
     * Conta ativada recebe as boas-vindas, uma vez só, numa conversa direta
     * com o sistema.
     */
    #[Test]
    public function conta_ativada_recebe_boas_vindas(): void
    {
        $id = $this->createUser();

        $this->assertSame(['welcome_user'], $this->sentTo($id));

        $messageId = $this->database()->table('canela_system_messages')->where('user_id', $id)->value('dialog_message_id');
        $message = $this->database()->table('dialog_messages')->where('id', $messageId)->first();
        $this->assertSame(5, (int) $message->user_id);

        $members = $this->database()->table('dialog_user')->where('dialog_id', $message->dialog_id)->pluck('user_id')->map(fn ($v) => (int) $v)->all();
        $this->assertEqualsCanonicalizing([5, $id], $members);
    }

    /**
     * Boas-vindas desligadas no admin: nada sai.
     */
    #[Test]
    public function boas_vindas_desligadas_nao_saem(): void
    {
        $this->setting('canela.sysmsg_welcome_user', '0');

        $id = $this->createUser();

        $this->assertSame([], $this->sentTo($id));
    }

    /**
     * Sem usuário do sistema configurado, nenhuma mensagem automática sai.
     */
    #[Test]
    public function sem_usuario_do_sistema_nada_sai(): void
    {
        $this->setting('canela.system_user_id', '');

        $id = $this->createUser();

        $this->assertSame([], $this->sentTo($id));
    }

    /**
     * Suspender alguém manda o aviso de suspensão, com o motivo (no texto
     * configurado no admin).
     */
    #[Test]
    public function suspensao_manda_aviso(): void
    {
        // O texto do admin substitui o padrão, com os marcadores preenchidos.
        $this->setting('canela.sysmsg_silenced_by_staff_body', 'Motivo: {reason}. Até {suspended_till}.');

        $response = $this->send($this->request('PATCH', '/api/users/2', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'id' => '2', 'attributes' => [
                'suspendedUntil' => Carbon::now()->addDays(3)->toIso8601String(),
                'suspendMessage' => 'Spam repetido',
            ]]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(['silenced_by_staff'], $this->sentTo(2));

        $messageId = $this->database()->table('canela_system_messages')->where('user_id', 2)->value('dialog_message_id');
        $content = (string) $this->database()->table('dialog_messages')->where('id', $messageId)->value('content');
        $this->assertStringContainsString('Motivo: Spam repetido.', $content);
        $this->assertStringNotContainsString('{suspended_till}', $content);
    }

    /**
     * A mensagem personalizada de "primeira postagem" sai só na primeira.
     */
    #[Test]
    public function primeira_postagem_manda_a_personalizada_uma_vez(): void
    {
        $this->setting('canela.sysmsg_custom', json_encode([[
            'id' => 'primeira', 'enabled' => true, 'trigger' => 'first_post', 'subject' => 'Parabéns',
            'body' => 'Sua primeira postagem, {username}!', 'createdAt' => Carbon::now()->toIso8601String(),
        ]]));

        foreach (['Primeira resposta', 'Segunda resposta'] as $content) {
            $response = $this->send($this->request('POST', '/api/posts', [
                'authenticatedAs' => 2,
                'json' => ['data' => ['type' => 'posts', 'attributes' => ['content' => $content], 'relationships' => [
                    'discussion' => ['data' => ['type' => 'discussions', 'id' => '1']],
                ]]],
            ]));

            $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

            // Fora da janela do limitador de postagens do core.
            $this->database()->table('posts')->where('user_id', 2)->update(['created_at' => Carbon::now()->subMinute()]);
        }

        $this->assertSame(['custom_primeira'], $this->sentTo(2));
    }

    /**
     * Ninguém responde à conversa do sistema: a API recusa, e a conversa já
     * chega com `canSendMessage` falso.
     */
    #[Test]
    public function conversa_do_sistema_nao_aceita_resposta(): void
    {
        $dialog = $this->json($this->send($this->request('GET', '/api/dialogs/20', ['authenticatedAs' => 2])));
        $this->assertFalse($dialog['data']['attributes']['canSendMessage']);

        $response = $this->send($this->request('POST', '/api/dialog-messages', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'dialog-messages', 'attributes' => ['content' => 'Respondendo'], 'relationships' => [
                'dialog' => ['data' => ['type' => 'dialogs', 'id' => '20']],
            ]]],
        ]));

        // 403 pela política do flarum/messages (ninguém escreve ao sistema)
        // ou 422 pelo BlockRepliesToSystem: de um jeito ou de outro, recusada.
        $this->assertContains($response->getStatusCode(), [403, 422]);
        $this->assertSame(1, $this->database()->table('dialog_messages')->where('dialog_id', 20)->count());
    }

    /**
     * Ninguém abre conversa nova com o sistema.
     */
    #[Test]
    public function ninguem_escreve_ao_sistema(): void
    {
        $response = $this->send($this->request('POST', '/api/dialog-messages', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'dialog-messages', 'attributes' => ['content' => 'Oi, sistema', 'users' => [['id' => 5]]]]],
        ]));

        $this->assertContains($response->getStatusCode(), [403, 422]);
        $this->assertSame(0, $this->database()->table('dialog_messages')->where('user_id', 2)->count());
    }

    /**
     * Nem a equipe convida alguém para a conversa do sistema.
     */
    #[Test]
    public function conversa_do_sistema_nao_recebe_convidados(): void
    {
        $this->database()->table('dialog_user')->insert(['dialog_id' => 20, 'user_id' => 1, 'joined_at' => Carbon::now(), 'last_read_message_id' => 201]);

        $response = $this->send($this->request('POST', '/api/dialogs/20/canela-invite', [
            'authenticatedAs' => 1,
            'json' => ['userIds' => [3]],
        ]));

        $this->assertEquals(403, $response->getStatusCode());
    }
}
