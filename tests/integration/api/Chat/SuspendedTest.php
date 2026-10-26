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

use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;

/**
 * Com o flarum/suspend, quem está suspenso lê o chat, mas não escreve, não
 * reage e não envia imagens (ChatAccess::isSuspended, motivo "silenced").
 */
class SuspendedTest extends AbstractChatTestCase
{
    protected array $extraExtensions = ['flarum-suspend'];

    private function suspend(int $userId): void
    {
        $this->database()->table('users')->where('id', $userId)->update(['suspended_until' => '2099-01-01 00:00:00']);
    }

    /** Suspenso não escreve, não reage e não envia imagens. */
    #[Test]
    public function suspenso_nao_escreve(): void
    {
        $id = $this->post(1, 3, 'Do moderador');

        $this->suspend(2);

        [$write] = $this->chat('POST', '/channels/1/messages', 2, ['message' => 'Oi']);
        [$react] = $this->chat('POST', "/messages/$id/reactions", 2, ['emoji' => '👍']);
        [$upload] = $this->chat('POST', '/uploads', 2);

        $this->assertEquals(403, $write);
        $this->assertEquals(403, $react);
        $this->assertEquals(403, $upload);
    }

    /**
     * Suspenso continua lendo, e o canal diz por que ele não escreve
     * ("silenced").
     *
     * BUG: o flarum/suspend troca os grupos do suspenso por [Visitante], e o
     * ChatAccess::allowed() confere `chat_allowed_groups` contra esses grupos —
     * o suspenso perde o chat inteiro (403), e o ramo "silenced" de
     * ChatAccess::cannotPostReason() nunca é alcançado.
     */
    #[Test]
    #[Group('bug')]
    public function suspenso_continua_lendo(): void
    {
        $this->post(1, 3, 'Do moderador');

        $this->suspend(2);

        [$read] = $this->chat('GET', '/channels/1/messages', 2);

        $this->assertEquals(200, $read);
        $this->assertEquals('silenced', $this->channelFor(1, 2)['cannotPostReason']);
    }
}
