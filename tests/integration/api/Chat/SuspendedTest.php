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
     * ("silenced"). O flarum/suspend troca os grupos de permissão do suspenso
     * por [Visitante]; o ChatAccess::allowed() confere `chat_allowed_groups`
     * contra os grupos de verdade dele.
     */
    #[Test]
    public function suspenso_continua_lendo(): void
    {
        $this->post(1, 3, 'Do moderador');

        $this->suspend(2);

        [$read] = $this->chat('GET', '/channels/1/messages', 2);

        $this->assertEquals(200, $read);
        $this->assertEquals('silenced', $this->channelFor(1, 2)['cannotPostReason']);
    }

    /**
     * Com o chat restrito a um grupo, o suspenso que está nele lê (pelos
     * grupos de verdade), mas não modera; quem não está no grupo continua de
     * fora, suspenso ou não.
     */
    #[Test]
    public function suspenso_le_pelos_grupos_de_verdade(): void
    {
        $this->setting('canela.chat_allowed_groups', '4');
        $this->setting('canela.chat_moderator_groups', '4');

        $this->suspend(3);
        $this->suspend(2);

        [$moderator] = $this->chat('GET', '/channels/1/messages', 3);
        [$member] = $this->chat('GET', '/channels/1/messages', 2);

        $this->assertEquals(200, $moderator);
        $this->assertEquals(403, $member);
        $this->assertEquals('silenced', $this->channelFor(1, 3)['cannotPostReason']);
    }
}
