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
 * Imagens no chat: `canela.chat_uploads_enabled` liga e desliga o envio.
 */
class UploadsTest extends AbstractChatTestCase
{
    /** Desligado no admin: 403. */
    #[Test]
    public function uploads_desligados_respondem_403(): void
    {
        $this->setting('canela.chat_uploads_enabled', '0');

        [$status] = $this->api('POST', '/chat/uploads', 2);

        $this->assertEquals(403, $status);
    }

    /** Ligado, mas sem arquivo: 422 em `file`. */
    #[Test]
    public function upload_sem_arquivo_responde_422(): void
    {
        [$status, $body] = $this->api('POST', '/chat/uploads', 2);

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/file', $body['errors'][0]['source']['pointer']);
    }

    /** Anexo de outra pessoa não entra na mensagem: sem texto, a mensagem fica vazia (422). */
    #[Test]
    public function anexo_alheio_nao_entra_na_mensagem(): void
    {
        $this->prepareDatabase([
            'canela_chat_uploads' => [
                ['id' => 1, 'user_id' => 3, 'path' => 'x.png', 'original_name' => 'x.png', 'mime' => 'image/png', 'size' => 10, 'width' => 1, 'height' => 1, 'created_at' => '2026-01-01 00:00:00'],
            ],
        ]);

        [$status] = $this->sendMessage(1, 2, '', ['uploadIds' => [1]]);

        $this->assertEquals(422, $status);
    }
}
