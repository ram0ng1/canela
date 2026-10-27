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
 * Participação: entrar, sair e o que muda para escrever no canal.
 */
class MembershipTest extends AbstractChatTestCase
{
    /**
     * Entrar num canal público passa a segui-lo, conta mais um participante
     * e começa com o histórico todo lido.
     */
    #[Test]
    public function entrar_no_canal_comeca_com_tudo_lido(): void
    {
        $last = $this->post(1, 2, 'Mensagem antiga');

        [$status, $body] = $this->api('POST', '/chat-channels/1/membership', 4);

        $this->assertEquals(200, $status, json_encode($body));
        $channel = self::data($body);
        $this->assertTrue($channel['membership']['following']);
        $this->assertEquals($last, $channel['membership']['lastReadMessageId']);
        $this->assertEquals(0, $channel['membership']['unreadCount']);
        $this->assertEquals(3, $channel['userCount']);
        $this->assertTrue($channel['canPost']);
    }

    /** Sair só deixa de seguir: a linha fica, e o canal volta a recusar a escrita. */
    #[Test]
    public function sair_do_canal_deixa_de_seguir(): void
    {
        [$status, $body] = $this->api('DELETE', '/chat-channels/1/membership', 2);

        $this->assertEquals(200, $status, json_encode($body));
        $channel = self::data($body);
        $this->assertFalse($channel['membership']['following']);
        $this->assertEquals(1, $channel['userCount']);
        $this->assertEquals('not_member', $channel['cannotPostReason']);

        [$post] = $this->sendMessage(1, 2, 'Ainda estou aqui?');
        $this->assertEquals(403, $post);
    }

    /** Quem não entrou no canal lê, mas não escreve: 403. */
    #[Test]
    public function quem_nao_participa_nao_escreve(): void
    {
        [$read] = $this->messages(1, 4);
        [$write] = $this->sendMessage(1, 4, 'Oi');

        $this->assertEquals(200, $read);
        $this->assertEquals(403, $write);
    }

    /** O estado do chat traz só os canais que a pessoa segue. */
    #[Test]
    public function estado_lista_os_canais_seguidos(): void
    {
        [, $member] = $this->api('GET', '/chat-channels/state', 2);
        [, $outsider] = $this->api('GET', '/chat-channels/state', 4);

        $this->assertEquals([1], array_column(self::data($member), 'id'));
        $this->assertSame([], $outsider['data']);
    }

    /** Canal com "adicionar automaticamente" entra no estado de quem abre o chat. */
    #[Test]
    public function canal_automatico_entra_sozinho(): void
    {
        $this->prepareDatabase([
            'canela_chat_channels' => [
                ['id' => 2, 'type' => 'public', 'name' => 'Boas-vindas', 'slug' => 'boas-vindas', 'status' => 0, 'auto_join' => true, 'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00'],
            ],
        ]);

        [, $body] = $this->api('GET', '/chat-channels/state', 4);

        $this->assertEquals([2], array_column(self::data($body), 'id'));
    }

    /** As preferências da participação (silenciar, favoritar, nível de aviso). */
    #[Test]
    public function atualiza_preferencias_da_participacao(): void
    {
        [$status, $body] = $this->api('PATCH', '/chat-channels/1/membership', 2, ['muted' => true, 'starred' => true, 'notificationLevel' => 'never']);

        $this->assertEquals(200, $status, json_encode($body));
        $membership = self::data($body)['membership'];
        $this->assertTrue($membership['muted']);
        $this->assertTrue($membership['starred']);
        $this->assertEquals('never', $membership['notificationLevel']);
    }
}
