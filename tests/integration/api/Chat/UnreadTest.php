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
 * Não lidas: o que os outros escrevem conta, a própria mensagem não, e
 * marcar como lido nunca volta atrás.
 */
class UnreadTest extends AbstractChatTestCase
{
    /** Mensagens dos outros contam como não lidas; as próprias, não. */
    #[Test]
    public function mensagens_dos_outros_contam_como_nao_lidas(): void
    {
        $this->post(1, 3, 'Uma');
        $this->post(1, 3, 'Duas');
        $this->post(1, 2, 'Minha');

        $this->assertEquals(0, $this->channelFor(1, 2)['membership']['unreadCount']);

        $this->post(1, 3, 'Três');

        $this->assertEquals(1, $this->channelFor(1, 2)['membership']['unreadCount']);
        $this->assertEquals(0, $this->channelFor(1, 3)['membership']['unreadCount']);
    }

    /** O contador do estado acompanha; marcar como lido zera. */
    #[Test]
    public function marcar_como_lido_zera_o_contador(): void
    {
        $this->post(1, 3, 'Uma');
        $last = $this->post(1, 3, 'Duas');

        [, $state] = $this->chat('GET', '/state', 2);
        $this->assertEquals(2, $state['channels'][0]['membership']['unreadCount']);

        [$status, $body] = $this->chat('POST', '/channels/1/read', 2);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals(0, $body['channel']['membership']['unreadCount']);
        $this->assertEquals($last, $body['channel']['membership']['lastReadMessageId']);
    }

    /** Ler até uma mensagem do meio deixa as seguintes como não lidas, e não "deslê". */
    #[Test]
    public function marcar_lido_ate_uma_mensagem_nunca_volta_atras(): void
    {
        $first = $this->post(1, 3, 'Uma');
        $second = $this->post(1, 3, 'Duas');
        $this->post(1, 3, 'Três');

        [, $body] = $this->chat('POST', '/channels/1/read', 2, ['messageId' => $second]);
        $this->assertEquals(1, $body['channel']['membership']['unreadCount']);

        [, $body] = $this->chat('POST', '/channels/1/read', 2, ['messageId' => $first]);
        $this->assertEquals($second, $body['channel']['membership']['lastReadMessageId']);
        $this->assertEquals(1, $body['channel']['membership']['unreadCount']);
    }

    /** Mensagem apagada sai da contagem. */
    #[Test]
    public function mensagem_apagada_sai_da_contagem(): void
    {
        $this->post(1, 3, 'Uma');
        $id = $this->post(1, 3, 'Duas');

        $this->chat('DELETE', "/messages/$id", 3);

        $this->assertEquals(1, $this->channelFor(1, 2)['membership']['unreadCount']);
    }
}
