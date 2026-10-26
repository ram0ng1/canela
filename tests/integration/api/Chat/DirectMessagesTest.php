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
 * Mensagens diretas: só os participantes enxergam — nem os administradores
 * leem as MDs dos outros (404, para não confirmar que existem).
 */
class DirectMessagesTest extends AbstractChatTestCase
{
    /** Abre a MD 1:1; a mesma dupla reaproveita a conversa existente. */
    #[Test]
    public function abre_e_reaproveita_a_md(): void
    {
        [$status, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('direct', $body['channel']['type']);
        $this->assertFalse($body['channel']['isGroup']);
        $this->assertEqualsCanonicalizing([2, 4], $body['channel']['participantIds']);

        [, $again] = $this->chat('POST', '/direct-messages', 4, ['userIds' => [2]]);

        $this->assertEquals($body['channel']['id'], $again['channel']['id']);
    }

    /**
     * Só os participantes leem a MD; o terceiro e o administrador recebem
     * 404, e a MD não aparece na lista de canais públicos.
     */
    #[Test]
    public function so_os_participantes_enxergam_a_md(): void
    {
        [, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);
        $id = $body['channel']['id'];
        $message = $this->post($id, 2, 'Só entre nós');

        [$recipient, $messages] = $this->chat('GET', "/channels/$id/messages", 4);
        $this->assertEquals(200, $recipient);
        $this->assertEquals([$message], array_column($messages['messages'], 'id'));

        [$third] = $this->chat('GET', "/channels/$id/messages", 3);
        [$admin] = $this->chat('GET', "/channels/$id", 1);
        [$single] = $this->chat('GET', "/messages/$message", 1);
        [$post] = $this->chat('POST', "/channels/$id/messages", 3, ['message' => 'Intruso']);
        [$join] = $this->chat('POST', "/channels/$id/membership", 3);

        $this->assertEquals(404, $third);
        $this->assertEquals(404, $admin);
        $this->assertEquals(404, $single);
        $this->assertEquals(404, $post);
        $this->assertEquals(404, $join);

        [, $list] = $this->chat('GET', '/channels', 2);
        $this->assertNotContains($id, array_column($list['channels'], 'id'));
    }

    /** A primeira mensagem conta como não lida para quem recebe. */
    #[Test]
    public function primeira_mensagem_chega_como_nao_lida(): void
    {
        [, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);
        $id = $body['channel']['id'];

        $this->post($id, 2, 'Oi!');

        [, $state] = $this->chat('GET', '/state', 4);
        $dm = array_values(array_filter($state['channels'], static fn ($c) => $c['id'] === $id));

        $this->assertCount(1, $dm);
        $this->assertEquals(1, $dm[0]['membership']['unreadCount']);
    }

    /** Numa MD, qualquer participante fixa. */
    #[Test]
    public function participante_fixa_na_md(): void
    {
        [, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);
        $message = $this->post($body['channel']['id'], 2, 'Lembrete');

        [$status, $pinned] = $this->chat('POST', "/messages/$message/pin", 4);

        $this->assertEquals(200, $status, json_encode($pinned));
        $this->assertTrue($pinned['message']['pinned']);
    }

    /** MDs desligadas no admin: abrir recusa (422 em `userIds`). */
    #[Test]
    public function mds_desligadas_recusam(): void
    {
        $this->setting('canela.chat_dm_enabled', '0');

        [$status, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/userIds', $body['errors'][0]['source']['pointer']);
    }

    /** Fora dos grupos de `canela.chat_dm_groups`: não abre MD. */
    #[Test]
    public function fora_dos_grupos_de_md_recusa(): void
    {
        $this->setting('canela.chat_dm_groups', '4');

        [$member] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [4]]);
        [$moderator] = $this->chat('POST', '/direct-messages', 3, ['userIds' => [4]]);

        $this->assertEquals(422, $member);
        $this->assertEquals(200, $moderator);
    }

    /** Destinatário inexistente: 422. */
    #[Test]
    public function destinatario_inexistente_responde_422(): void
    {
        [$status] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [999]]);

        $this->assertEquals(422, $status);
    }

    /** Sair de um grupo de MD tira o acesso a ele. */
    #[Test]
    public function sair_do_grupo_tira_o_acesso(): void
    {
        [, $body] = $this->chat('POST', '/direct-messages', 2, ['userIds' => [3, 4]]);
        $id = $body['channel']['id'];
        $this->assertTrue($body['channel']['isGroup']);

        [$left] = $this->chat('DELETE', "/channels/$id/membership", 4);
        [$after] = $this->chat('GET', "/channels/$id", 4);

        $this->assertEquals(204, $left);
        $this->assertEquals(404, $after);
    }
}
