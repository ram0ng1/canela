<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Messages;

use Carbon\Carbon;
use Flarum\Messages\Dialog;
use Flarum\Messages\DialogMessage;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * As ações que o tema soma às conversas do flarum/messages: sair (ou tirar
 * alguém), convidar pessoas ou a equipe, e marcar como não lida. Cada uma só
 * vale para quem participa da conversa — para quem está de fora, a conversa
 * "não existe" (404).
 *
 * Cenário: a conversa 10 é a dois entre normal (2, quem começou) e alice
 * (3), com duas mensagens, lidas por ambos. bob (4) e carol (5) estão de fora.
 */
class DialogActionsTest extends TestCase
{
    use RetrievesAuthorizedUsers;
    use RerunsMessagesMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        $this->rerunMessagesMigrations();
        $this->extension('flarum-messages', 'ramon-canela');

        $now = Carbon::now();

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'alice', 'email' => 'alice@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'bob', 'email' => 'bob@machine.local', 'is_email_confirmed' => 1],
                ['id' => 5, 'username' => 'carol', 'email' => 'carol@machine.local', 'is_email_confirmed' => 1],
            ],
            Dialog::class => [
                ['id' => 10, 'type' => 'direct', 'first_message_id' => 101, 'last_message_id' => 102, 'last_message_at' => $now, 'created_at' => $now],
            ],
            DialogMessage::class => [
                ['id' => 101, 'dialog_id' => 10, 'user_id' => 2, 'content' => '<t>Oi, Alice</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 102, 'dialog_id' => 10, 'user_id' => 3, 'content' => '<t>Oi!</t>', 'number' => 2, 'created_at' => $now],
            ],
            'dialog_user' => [
                ['dialog_id' => 10, 'user_id' => 2, 'joined_at' => $now, 'last_read_message_id' => 102],
                ['dialog_id' => 10, 'user_id' => 3, 'joined_at' => $now, 'last_read_message_id' => 102],
            ],
        ]);
    }

    private function state(int $userId): ?object
    {
        return $this->database()->table('dialog_user')->where('dialog_id', 10)->where('user_id', $userId)->first();
    }

    private function invite(int $as, array $body): ResponseInterface
    {
        return $this->send($this->request('POST', '/api/dialogs/10/canela-invite', ['authenticatedAs' => $as, 'json' => $body]));
    }

    /**
     * Sair da conversa: a linha da pessoa some e fica o aviso "se removeu".
     */
    #[Test]
    public function participante_sai_da_conversa(): void
    {
        $response = $this->send($this->request('DELETE', '/api/dialogs/10/canela-membership', ['authenticatedAs' => 3]));

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNull($this->state(3));
        $this->assertNotNull($this->state(2));

        $event = $this->database()->table('canela_dialog_events')->where('dialog_id', 10)->first();
        $this->assertSame('user_left', $event->type);
        $this->assertSame(3, (int) $event->target_user_id);
    }

    /**
     * Visitante não sai de nada; quem está de fora não acha a conversa.
     */
    #[Test]
    public function visitante_e_estranho_nao_saem(): void
    {
        // 400 (sem token CSRF) ou 401 (sem conta).
        $this->assertContains($this->send($this->request('DELETE', '/api/dialogs/10/canela-membership'))->getStatusCode(), [400, 401]);
        $this->assertEquals(404, $this->send($this->request('DELETE', '/api/dialogs/10/canela-membership', ['authenticatedAs' => 5]))->getStatusCode());
        $this->assertNotNull($this->state(2));
        $this->assertNotNull($this->state(3));
    }

    /**
     * Tirar outra pessoa: só quem começou a conversa (ou a equipe). A outra
     * participante não pode tirar quem começou.
     */
    #[Test]
    public function so_quem_comecou_tira_os_outros(): void
    {
        $denied = $this->send($this->request('DELETE', '/api/dialogs/10/canela-membership', ['authenticatedAs' => 3])->withQueryParams(['userId' => 2]));
        $this->assertEquals(403, $denied->getStatusCode());
        $this->assertNotNull($this->state(2));

        $allowed = $this->send($this->request('DELETE', '/api/dialogs/10/canela-membership', ['authenticatedAs' => 2])->withQueryParams(['userId' => 3]));
        $this->assertEquals(204, $allowed->getStatusCode());
        $this->assertNull($this->state(3));
        $this->assertSame('removed_user', $this->database()->table('canela_dialog_events')->where('dialog_id', 10)->value('type'));
    }

    /**
     * Marcar como não lida volta a leitura para antes da última mensagem, só
     * para quem pediu.
     */
    #[Test]
    public function marcar_como_nao_lida(): void
    {
        $response = $this->send($this->request('POST', '/api/dialogs/10/canela-unread', ['authenticatedAs' => 2]));

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(101, (int) $this->state(2)->last_read_message_id);
        $this->assertSame(102, (int) $this->state(3)->last_read_message_id);
    }

    /**
     * Quem está de fora não mexe na leitura da conversa (404).
     */
    #[Test]
    public function estranho_nao_marca_como_nao_lida(): void
    {
        $response = $this->send($this->request('POST', '/api/dialogs/10/canela-unread', ['authenticatedAs' => 5]));

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertSame(102, (int) $this->state(2)->last_read_message_id);
    }

    /**
     * Convidar: a pessoa entra com a última mensagem como não lida, a conversa
     * deixa de ser "a dois" e fica o aviso "convidou fulano".
     */
    #[Test]
    public function participante_convida_alguem(): void
    {
        $response = $this->invite(2, ['userIds' => [4]]);

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNotNull($this->state(4));
        $this->assertSame(101, (int) $this->state(4)->last_read_message_id);
        $this->assertSame('canela_group', $this->database()->table('dialogs')->where('id', 10)->value('type'));

        $event = $this->database()->table('canela_dialog_events')->where('dialog_id', 10)->first();
        $this->assertSame('invited_user', $event->type);
        $this->assertSame(4, (int) $event->target_user_id);

        // A convidada passa a ver a conversa.
        $this->assertEquals(200, $this->send($this->request('GET', '/api/dialogs/10', ['authenticatedAs' => 4]))->getStatusCode());
    }

    /**
     * Quem está de fora não convida ninguém (nem a si mesmo).
     */
    #[Test]
    public function estranho_nao_convida(): void
    {
        $response = $this->invite(5, ['userIds' => [5]]);

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertNull($this->state(5));
    }

    /**
     * Convite vazio e grupo que não é da equipe são recusados (422).
     */
    #[Test]
    public function convite_invalido_e_recusado(): void
    {
        $this->assertEquals(422, $this->invite(2, [])->getStatusCode());
        $this->assertEquals(422, $this->invite(2, ['groupId' => 3])->getStatusCode());
        $this->assertSame('direct', $this->database()->table('dialogs')->where('id', 10)->value('type'));
    }

    /**
     * Convidar a equipe: a conversa vai para a caixa do grupo e os membros da
     * equipe entram "pelo grupo"; convidar o mesmo grupo de novo é recusado.
     */
    #[Test]
    public function convidar_a_equipe_converte_a_conversa(): void
    {
        $response = $this->invite(2, ['groupId' => 1]);

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());

        $dialog = $this->database()->table('dialogs')->where('id', 10)->first();
        $this->assertSame('canela_group', $dialog->type);
        $this->assertSame(1, (int) $dialog->canela_group_id);

        $admin = $this->state(1);
        $this->assertNotNull($admin);
        $this->assertTrue((bool) $admin->canela_via_group);
        $this->assertFalse((bool) $this->state(2)->canela_via_group);

        $this->assertEquals(422, $this->invite(2, ['groupId' => 1])->getStatusCode());
    }

    /**
     * Convidar só quem já está na conversa não acrescenta ninguém: ela devia
     * continuar "a dois" (`direct`), senão o flarum/messages deixa de
     * reaproveitá-la para novas mensagens entre as duas pessoas.
     *
     * Bug: DialogActions::inviteEndpoint muda o tipo para `canela_group`
     * mesmo quando nenhum convidado entrou (src/Messages/Api/DialogActions.php:136).
     */
    #[Test]
    #[Group('bug')]
    public function convidar_quem_ja_participa_nao_converte_a_conversa(): void
    {
        $response = $this->invite(2, ['userIds' => [3]]);

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertSame('direct', $this->database()->table('dialogs')->where('id', 10)->value('type'));
    }
}
