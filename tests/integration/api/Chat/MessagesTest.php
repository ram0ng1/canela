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
 * Mensagens: enviar, editar, apagar, restaurar, reagir e fixar, com as
 * regras de quem pode cada coisa.
 */
class MessagesTest extends AbstractChatTestCase
{
    /** O participante envia uma mensagem e ela aparece na lista do canal. */
    #[Test]
    public function participante_envia_mensagem(): void
    {
        [$status, $body] = $this->sendMessage(1, 2, 'Olá, **pessoal**');

        $this->assertEquals(201, $status, json_encode($body));
        $message = self::data($body);
        $this->assertEquals('Olá, **pessoal**', $message['message']);
        $this->assertStringContainsString('pessoal', $message['cooked']);
        $this->assertEquals(2, $message['userId']);
        $this->assertContains('2', self::includedIds($body, 'users'));

        [, $list] = $this->messages(1, 3);

        $this->assertEquals([$message['id']], array_column(self::data($list), 'id'));
    }

    /** Mensagem vazia (só espaços) não passa: 422. */
    #[Test]
    public function mensagem_vazia_responde_422(): void
    {
        [$status, $body] = $this->sendMessage(1, 2, "   \n ");

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/message', $body['errors'][0]['source']['pointer']);
    }

    /** Acima de `canela.chat_max_message_length`: 422. */
    #[Test]
    public function mensagem_longa_demais_responde_422(): void
    {
        $this->setting('canela.chat_max_message_length', 50);

        [$status] = $this->sendMessage(1, 2, str_repeat('a', 51));

        $this->assertEquals(422, $status);
    }

    /** O autor edita a própria mensagem; o texto e a marca de edição mudam. */
    #[Test]
    public function autor_edita_a_propria_mensagem(): void
    {
        $id = $this->post(1, 2, 'Primeira versão');

        [$status, $body] = $this->api('PATCH', "/chat-messages/$id", 2, self::document('chat-messages', ['message' => 'Segunda versão']));

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('Segunda versão', self::data($body)['message']);
        $this->assertNotNull(self::data($body)['editedAt']);
    }

    /** Ninguém edita a mensagem de outra pessoa — nem a moderação: 403. */
    #[Test]
    public function ninguem_edita_mensagem_alheia(): void
    {
        $id = $this->post(1, 2, 'Minha');

        [$other] = $this->api('PATCH', "/chat-messages/$id", 3, self::document('chat-messages', ['message' => 'Mexi']));

        $this->assertEquals(403, $other);
        $this->assertEquals('Minha', $this->database()->table('canela_chat_messages')->where('id', $id)->value('message'));
    }

    /** Membro comum não apaga a mensagem de outro: 403. */
    #[Test]
    public function membro_nao_apaga_mensagem_alheia(): void
    {
        $id = $this->post(1, 3, 'Do moderador');

        $this->api('POST', '/chat-channels/1/membership', 4);
        [$status] = $this->api('DELETE', "/chat-messages/$id", 4);

        $this->assertEquals(403, $status);
        $this->assertNull($this->database()->table('canela_chat_messages')->where('id', $id)->value('deleted_at'));
    }

    /**
     * A moderação apaga a mensagem alheia; apagada, ela some (404) para os
     * outros e continua visível (recolhida) para o autor.
     */
    #[Test]
    public function moderacao_apaga_mensagem_alheia(): void
    {
        $id = $this->post(1, 2, 'Vai sumir');

        [$status, $body] = $this->api('DELETE', "/chat-messages/$id", 3);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertNotNull(self::data($body)['deletedAt']);
        $this->assertEquals(3, self::data($body)['deletedById']);

        [$outsider] = $this->api('GET', "/chat-messages/$id", 4);
        [$author] = $this->api('GET', "/chat-messages/$id", 2);

        $this->assertEquals(404, $outsider);
        $this->assertEquals(200, $author);
    }

    /** O autor apaga a própria e a restaura; a apagada pela moderação ele não restaura. */
    #[Test]
    public function autor_restaura_so_o_que_ele_mesmo_apagou(): void
    {
        $own = $this->post(1, 2, 'Apago e volto');
        $this->api('DELETE', "/chat-messages/$own", 2);

        [$restored, $body] = $this->api('POST', "/chat-messages/$own/restore", 2);

        $this->assertEquals(200, $restored, json_encode($body));
        $this->assertNull(self::data($body)['deletedAt']);

        $moderated = $this->post(1, 2, 'A moderação apaga');
        $this->api('DELETE', "/chat-messages/$moderated", 3);

        [$denied] = $this->api('POST', "/chat-messages/$moderated/restore", 2);

        $this->assertEquals(403, $denied);
    }

    /** Reagir com um emoji liga e desliga a reação do ator. */
    #[Test]
    public function reagir_liga_e_desliga(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status, $body] = $this->api('POST', "/chat-messages/$id/reactions", 2, ['emoji' => '👍']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals([['emoji' => '👍', 'count' => 1, 'userIds' => [2]]], self::data($body)['reactions']);
        // Quem reagiu vai para o store (a dica "Fulano reagiu com…").
        $this->assertContains('2', self::includedIds($body, 'users'));

        [, $removed] = $this->api('POST', "/chat-messages/$id/reactions", 2, ['emoji' => '👍', 'action' => 'remove']);

        $this->assertSame([], self::data($removed)['reactions']);
    }

    /** O campo do emoji vira HTML nas reações: texto qualquer é recusado (422). */
    #[Test]
    public function reacao_que_nao_e_emoji_responde_422(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status] = $this->api('POST', "/chat-messages/$id/reactions", 2, ['emoji' => '<b>x</b>']);

        $this->assertEquals(422, $status);
    }

    /** Reagir pede a mesma permissão de escrever: quem não participa recebe 403. */
    #[Test]
    public function quem_nao_participa_nao_reage(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status] = $this->api('POST', "/chat-messages/$id/reactions", 4, ['emoji' => '👍']);

        $this->assertEquals(403, $status);
    }

    /** Num canal público só a moderação fixa; a fixada aparece na lista de fixadas. */
    #[Test]
    public function so_a_moderacao_fixa_no_canal_publico(): void
    {
        $id = $this->post(1, 2, 'Importante');

        [$denied] = $this->api('POST', "/chat-messages/$id/pin", 2);
        $this->assertEquals(403, $denied);

        [$status, $body] = $this->api('POST', "/chat-messages/$id/pin", 3);
        $this->assertEquals(200, $status, json_encode($body));
        $this->assertTrue(self::data($body)['pinned']);
        $this->assertEquals(3, self::data($body)['pinnedById']);

        [, $pins] = $this->api('GET', '/chat-channels/1/pins', 2);
        $this->assertEquals([$id], array_column(self::data($pins), 'id'));

        [, $unpinned] = $this->api('DELETE', "/chat-messages/$id/pin", 3);
        $this->assertFalse(self::data($unpinned)['pinned']);
    }

    /** Com `canela.chat_pins_enabled` desligado, nem a moderação fixa. */
    #[Test]
    public function fixar_desligado_responde_403(): void
    {
        $this->setting('canela.chat_pins_enabled', '0');

        $id = $this->post(1, 2, 'Importante');

        [$status] = $this->api('POST', "/chat-messages/$id/pin", 3);

        $this->assertEquals(403, $status);
    }

    /** Canal fechado: só a moderação escreve. */
    #[Test]
    public function canal_fechado_so_a_moderacao_escreve(): void
    {
        $this->database()->table('canela_chat_channels')->where('id', 1)->update(['status' => 2]);

        [$member] = $this->sendMessage(1, 2, 'Oi');
        [$moderator] = $this->sendMessage(1, 3, 'Aviso');

        $this->assertEquals(403, $member);
        $this->assertEquals(201, $moderator);
    }

    /** O HTML digitado não vira HTML: o `cooked` sai escapado. */
    #[Test]
    public function html_da_mensagem_sai_escapado(): void
    {
        [, $body] = $this->sendMessage(1, 2, '<script>alert(1)</script>');

        $this->assertStringNotContainsString('<script>', self::data($body)['cooked']);
        $this->assertStringContainsString('&lt;script&gt;', self::data($body)['cooked']);
    }
}
