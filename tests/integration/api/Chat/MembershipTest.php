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

        [$status, $body] = $this->chat('POST', '/channels/1/membership', 4);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertTrue($body['channel']['membership']['following']);
        $this->assertEquals($last, $body['channel']['membership']['lastReadMessageId']);
        $this->assertEquals(0, $body['channel']['membership']['unreadCount']);
        $this->assertEquals(3, $body['channel']['userCount']);
        $this->assertTrue($body['channel']['canPost']);
    }

    /** Sair só deixa de seguir: a linha fica, e o canal volta a recusar a escrita. */
    #[Test]
    public function sair_do_canal_deixa_de_seguir(): void
    {
        [$status, $body] = $this->chat('DELETE', '/channels/1/membership', 2);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertFalse($body['channel']['membership']['following']);
        $this->assertEquals(1, $body['channel']['userCount']);
        $this->assertEquals('not_member', $body['channel']['cannotPostReason']);

        [$post] = $this->chat('POST', '/channels/1/messages', 2, ['message' => 'Ainda estou aqui?']);
        $this->assertEquals(403, $post);
    }

    /** Quem não entrou no canal lê, mas não escreve: 403. */
    #[Test]
    public function quem_nao_participa_nao_escreve(): void
    {
        [$read] = $this->chat('GET', '/channels/1/messages', 4);
        [$write] = $this->chat('POST', '/channels/1/messages', 4, ['message' => 'Oi']);

        $this->assertEquals(200, $read);
        $this->assertEquals(403, $write);
    }

    /** O estado do chat traz só os canais que a pessoa segue. */
    #[Test]
    public function estado_lista_os_canais_seguidos(): void
    {
        [, $member] = $this->chat('GET', '/state', 2);
        [, $outsider] = $this->chat('GET', '/state', 4);

        $this->assertEquals([1], array_column($member['channels'], 'id'));
        $this->assertSame([], $outsider['channels']);
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

        [, $body] = $this->chat('GET', '/state', 4);

        $this->assertEquals([2], array_column($body['channels'], 'id'));
    }

    /** As preferências da participação (silenciar, favoritar, nível de aviso). */
    #[Test]
    public function atualiza_preferencias_da_participacao(): void
    {
        [$status, $body] = $this->chat('PATCH', '/channels/1/membership', 2, ['muted' => true, 'starred' => true, 'notificationLevel' => 'never']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertTrue($body['channel']['membership']['muted']);
        $this->assertTrue($body['channel']['membership']['starred']);
        $this->assertEquals('never', $body['channel']['membership']['notificationLevel']);
    }
}
