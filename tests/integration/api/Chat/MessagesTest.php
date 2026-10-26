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
        [$status, $body] = $this->chat('POST', '/channels/1/messages', 2, ['message' => 'Olá, **pessoal**']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('Olá, **pessoal**', $body['message']['message']);
        $this->assertStringContainsString('pessoal', $body['message']['cooked']);
        $this->assertEquals(2, $body['message']['userId']);
        $this->assertContains('2', array_column($body['users'], 'id'));

        [, $list] = $this->chat('GET', '/channels/1/messages', 3);

        $this->assertEquals([$body['message']['id']], array_column($list['messages'], 'id'));
    }

    /** Mensagem vazia (só espaços) não passa: 422. */
    #[Test]
    public function mensagem_vazia_responde_422(): void
    {
        [$status, $body] = $this->chat('POST', '/channels/1/messages', 2, ['message' => "   \n "]);

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/message', $body['errors'][0]['source']['pointer']);
    }

    /** Acima de `canela.chat_max_message_length`: 422. */
    #[Test]
    public function mensagem_longa_demais_responde_422(): void
    {
        $this->setting('canela.chat_max_message_length', 50);

        [$status] = $this->chat('POST', '/channels/1/messages', 2, ['message' => str_repeat('a', 51)]);

        $this->assertEquals(422, $status);
    }

    /** O autor edita a própria mensagem; o texto e a marca de edição mudam. */
    #[Test]
    public function autor_edita_a_propria_mensagem(): void
    {
        $id = $this->post(1, 2, 'Primeira versão');

        [$status, $body] = $this->chat('PATCH', "/messages/$id", 2, ['message' => 'Segunda versão']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('Segunda versão', $body['message']['message']);
        $this->assertNotNull($body['message']['editedAt']);
    }

    /** Ninguém edita a mensagem de outra pessoa — nem a moderação: 403. */
    #[Test]
    public function ninguem_edita_mensagem_alheia(): void
    {
        $id = $this->post(1, 2, 'Minha');

        [$other] = $this->chat('PATCH', "/messages/$id", 3, ['message' => 'Mexi']);

        $this->assertEquals(403, $other);
        $this->assertEquals('Minha', $this->database()->table('canela_chat_messages')->where('id', $id)->value('message'));
    }

    /** Membro comum não apaga a mensagem de outro: 403. */
    #[Test]
    public function membro_nao_apaga_mensagem_alheia(): void
    {
        $id = $this->post(1, 3, 'Do moderador');

        $this->chat('POST', '/channels/1/membership', 4);
        [$status] = $this->chat('DELETE', "/messages/$id", 4);

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

        [$status, $body] = $this->chat('DELETE', "/messages/$id", 3);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertNotNull($body['message']['deletedAt']);
        $this->assertEquals(3, $body['message']['deletedById']);

        [$outsider] = $this->chat('GET', "/messages/$id", 4);
        [$author] = $this->chat('GET', "/messages/$id", 2);

        $this->assertEquals(404, $outsider);
        $this->assertEquals(200, $author);
    }

    /** O autor apaga a própria e a restaura; a apagada pela moderação ele não restaura. */
    #[Test]
    public function autor_restaura_so_o_que_ele_mesmo_apagou(): void
    {
        $own = $this->post(1, 2, 'Apago e volto');
        $this->chat('DELETE', "/messages/$own", 2);

        [$restored, $body] = $this->chat('POST', "/messages/$own/restore", 2);

        $this->assertEquals(200, $restored, json_encode($body));
        $this->assertNull($body['message']['deletedAt']);

        $moderated = $this->post(1, 2, 'A moderação apaga');
        $this->chat('DELETE', "/messages/$moderated", 3);

        [$denied] = $this->chat('POST', "/messages/$moderated/restore", 2);

        $this->assertEquals(403, $denied);
    }

    /** Reagir com um emoji liga e desliga a reação do ator. */
    #[Test]
    public function reagir_liga_e_desliga(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status, $body] = $this->chat('POST', "/messages/$id/reactions", 2, ['emoji' => '👍']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals([['emoji' => '👍', 'count' => 1, 'userIds' => [2]]], $body['message']['reactions']);

        [, $removed] = $this->chat('POST', "/messages/$id/reactions", 2, ['emoji' => '👍', 'action' => 'remove']);

        $this->assertSame([], $removed['message']['reactions']);
    }

    /** O campo do emoji vira HTML nas reações: texto qualquer é recusado (422). */
    #[Test]
    public function reacao_que_nao_e_emoji_responde_422(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status] = $this->chat('POST', "/messages/$id/reactions", 2, ['emoji' => '<b>x</b>']);

        $this->assertEquals(422, $status);
    }

    /** Reagir pede a mesma permissão de escrever: quem não participa recebe 403. */
    #[Test]
    public function quem_nao_participa_nao_reage(): void
    {
        $id = $this->post(1, 3, 'Reaja');

        [$status] = $this->chat('POST', "/messages/$id/reactions", 4, ['emoji' => '👍']);

        $this->assertEquals(403, $status);
    }

    /** Num canal público só a moderação fixa; a fixada aparece na lista de fixadas. */
    #[Test]
    public function so_a_moderacao_fixa_no_canal_publico(): void
    {
        $id = $this->post(1, 2, 'Importante');

        [$denied] = $this->chat('POST', "/messages/$id/pin", 2);
        $this->assertEquals(403, $denied);

        [$status, $body] = $this->chat('POST', "/messages/$id/pin", 3);
        $this->assertEquals(200, $status, json_encode($body));
        $this->assertTrue($body['message']['pinned']);
        $this->assertEquals(3, $body['message']['pinnedById']);

        [, $pins] = $this->chat('GET', '/channels/1/pins', 2);
        $this->assertEquals([$id], array_column($pins['messages'], 'id'));

        [, $unpinned] = $this->chat('DELETE', "/messages/$id/pin", 3);
        $this->assertFalse($unpinned['message']['pinned']);
    }

    /** Com `canela.chat_pins_enabled` desligado, nem a moderação fixa. */
    #[Test]
    public function fixar_desligado_responde_403(): void
    {
        $this->setting('canela.chat_pins_enabled', '0');

        $id = $this->post(1, 2, 'Importante');

        [$status] = $this->chat('POST', "/messages/$id/pin", 3);

        $this->assertEquals(403, $status);
    }

    /** Canal fechado: só a moderação escreve. */
    #[Test]
    public function canal_fechado_so_a_moderacao_escreve(): void
    {
        $this->database()->table('canela_chat_channels')->where('id', 1)->update(['status' => 2]);

        [$member] = $this->chat('POST', '/channels/1/messages', 2, ['message' => 'Oi']);
        [$moderator] = $this->chat('POST', '/channels/1/messages', 3, ['message' => 'Aviso']);

        $this->assertEquals(403, $member);
        $this->assertEquals(200, $moderator);
    }

    /** O HTML digitado não vira HTML: o `cooked` sai escapado. */
    #[Test]
    public function html_da_mensagem_sai_escapado(): void
    {
        [, $body] = $this->chat('POST', '/channels/1/messages', 2, ['message' => '<script>alert(1)</script>']);

        $this->assertStringNotContainsString('<script>', $body['message']['cooked']);
        $this->assertStringContainsString('&lt;script&gt;', $body['message']['cooked']);
    }
}
