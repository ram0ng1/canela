<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Chat;

use PHPUnit\Framework\Attributes\Test;

/**
 * Fios: responder a uma mensagem num canal com fios abre (ou continua) o fio
 * dela; as respostas moram no painel do fio, fora da conversa principal.
 */
class ThreadsTest extends AbstractChatTestCase
{
    /** Responder abre o fio; a original ganha o indicador e a resposta fica no fio. */
    #[Test]
    public function responder_abre_o_fio(): void
    {
        $original = $this->post(1, 3, 'Pergunta');

        [$status, $body] = $this->sendMessage(1, 2, 'Resposta', ['inReplyToId' => $original]);

        $this->assertEquals(201, $status, json_encode($body));
        $threadId = self::data($body)['threadId'];
        $this->assertNotNull($threadId);

        // A conversa principal mostra só a original, com o resumo do fio.
        [, $main] = $this->messages(1, 4);
        $this->assertEquals([$original], array_column(self::data($main), 'id'));
        $this->assertEquals(1, self::data($main)[0]['thread']['replyCount']);

        // O painel do fio traz as duas.
        [, $thread] = $this->messages(1, 4, ['thread' => $threadId]);
        $this->assertCount(2, self::data($thread));

        [, $list] = $this->api('GET', '/chat-threads', 2, null, ['filter' => ['channel' => 1]]);
        $this->assertEquals([$threadId], array_column(self::data($list), 'id'));
        // A original vem incluída, para a lista mostrar o começo dela.
        $this->assertEquals([(string) $original], self::includedIds($list, 'chat-messages'));
    }

    /**
     * O autor da original acompanha o fio: a resposta dos outros vira um fio
     * não lido para ele, e ler o fio zera.
     */
    #[Test]
    public function autor_da_original_acompanha_o_fio(): void
    {
        $original = $this->post(1, 3, 'Pergunta');
        [, $body] = $this->sendMessage(1, 2, 'Resposta', ['inReplyToId' => $original]);
        $threadId = self::data($body)['threadId'];

        $this->assertEquals(1, $this->channelFor(1, 3)['membership']['unreadThreadsCount']);

        [, $thread] = $this->api('GET', "/chat-threads/$threadId", 3);
        $this->assertEquals(1, self::data($thread)['membership']['unreadCount']);

        [$status, $read] = $this->api('POST', "/chat-threads/$threadId/read", 3);
        $this->assertEquals(200, $status);
        $this->assertEquals(0, self::data($read)['membership']['unreadCount']);
        $this->assertEquals(0, $this->channelFor(1, 3)['membership']['unreadThreadsCount']);
    }

    /** O título do fio é de quem abriu a original e da moderação. */
    #[Test]
    public function so_o_autor_e_a_moderacao_dao_titulo_ao_fio(): void
    {
        $original = $this->post(1, 2, 'Pergunta');
        [, $body] = $this->sendMessage(1, 3, 'Resposta', ['inReplyToId' => $original]);
        $threadId = self::data($body)['threadId'];

        $this->api('POST', '/chat-channels/1/membership', 4);
        [$denied] = $this->api('PATCH', "/chat-threads/$threadId", 4, self::document('chat-threads', ['title' => 'Meu título']));
        [$allowed, $thread] = $this->api('PATCH', "/chat-threads/$threadId", 2, self::document('chat-threads', ['title' => 'Dúvida']));

        $this->assertEquals(403, $denied);
        $this->assertEquals(200, $allowed);
        $this->assertEquals('Dúvida', self::data($thread)['title']);
    }

    /**
     * Com `canela.chat_threads_enabled` desligado, responder não abre fio e a
     * lista de fios responde 404.
     */
    #[Test]
    public function fios_desligados_no_admin(): void
    {
        $this->setting('canela.chat_threads_enabled', '0');

        $original = $this->post(1, 3, 'Pergunta');
        [, $body] = $this->sendMessage(1, 2, 'Resposta', ['inReplyToId' => $original]);

        $this->assertNull(self::data($body)['threadId']);
        $this->assertEquals($original, self::data($body)['inReplyTo']['id']);

        [$status] = $this->api('GET', '/chat-threads', 2, null, ['filter' => ['channel' => 1]]);
        $this->assertEquals(404, $status);
    }

    /** Responder a uma mensagem de outro canal (ou inexistente): 422. */
    #[Test]
    public function responder_a_mensagem_inexistente_responde_422(): void
    {
        [$status] = $this->sendMessage(1, 2, 'Resposta', ['inReplyToId' => 999]);

        $this->assertEquals(422, $status);
    }
}
