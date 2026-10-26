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
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * O que o tema soma aos dados das conversas: título (só ao nascer),
 * arquivo por pessoa e as caixas, conversa com várias pessoas, a conversão
 * para a caixa da equipe e as contagens do perfil (só para a própria pessoa).
 *
 * Cenário: a conversa 10 é a dois entre normal (2) e alice (3); bob (4) está
 * de fora. O admin (1) é a equipe.
 */
class DialogFieldsTest extends TestCase
{
    use RetrievesAuthorizedUsers;
    use RerunsMessagesMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        $this->rerunMessagesMigrations();
        $this->extension('flarum-messages', 'ramon-canela');

        // Duas horas atrás: o limitador do flarum/messages barra quem escreveu agora.
        $now = Carbon::now()->subHours(2);

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'alice', 'email' => 'alice@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'bob', 'email' => 'bob@machine.local', 'is_email_confirmed' => 1],
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
                ['dialog_id' => 10, 'user_id' => 3, 'joined_at' => $now, 'last_read_message_id' => 101],
            ],
        ]);
    }

    private function json(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    private function message(int $as, array $attributes, ?int $dialogId = null): ResponseInterface
    {
        $data = ['type' => 'dialog-messages', 'attributes' => $attributes];

        if ($dialogId) {
            $data['relationships'] = ['dialog' => ['data' => ['type' => 'dialogs', 'id' => (string) $dialogId]]];
        }

        return $this->send($this->request('POST', '/api/dialog-messages', ['authenticatedAs' => $as, 'json' => ['data' => $data]]));
    }

    private function box(int $as, string $box): array
    {
        $response = $this->send($this->request('GET', '/api/dialogs', ['authenticatedAs' => $as])->withQueryParams(['filter' => ['canelaBox' => $box]]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return array_map('intval', array_column($this->json($response)['data'], 'id'));
    }

    private function archive(int $as, bool $archived): ResponseInterface
    {
        return $this->send($this->request('PATCH', '/api/dialogs/10', [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => 'dialogs', 'id' => '10', 'attributes' => ['canelaArchived' => $archived]]],
        ]));
    }

    /**
     * O título enviado com a primeira mensagem dá nome à conversa nova.
     */
    #[Test]
    public function titulo_nasce_com_a_conversa(): void
    {
        $response = $this->message(2, ['content' => 'Olá, Bob', 'users' => [['id' => 4]], 'canelaTitle' => '  Assunto importante  ']);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $dialogId = (int) $this->json($response)['data']['relationships']['dialog']['data']['id'];

        $this->assertSame('Assunto importante', $this->database()->table('dialogs')->where('id', $dialogId)->value('canela_title'));

        $dialog = $this->json($this->send($this->request('GET', "/api/dialogs/$dialogId", ['authenticatedAs' => 4])));
        $this->assertSame('Assunto importante', $dialog['data']['attributes']['canelaTitle']);
    }

    /**
     * Uma resposta numa conversa que já existe não dá nome a ela.
     */
    #[Test]
    public function resposta_nao_renomeia_a_conversa(): void
    {
        $response = $this->message(2, ['content' => 'Mais uma', 'canelaTitle' => 'Outro nome'], 10);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNull($this->database()->table('dialogs')->where('id', 10)->value('canela_title'));
    }

    /**
     * Título acima do limite é recusado.
     */
    #[Test]
    public function titulo_longo_demais_e_recusado(): void
    {
        $response = $this->message(2, ['content' => 'Olá', 'users' => [['id' => 4]], 'canelaTitle' => str_repeat('a', 256)]);

        $this->assertEquals(422, $response->getStatusCode());
    }

    /**
     * Arquivar é da pessoa, não da conversa: sai da caixa de entrada dela e
     * vai para o arquivo; para a outra participante nada muda.
     */
    #[Test]
    public function arquivar_e_por_pessoa(): void
    {
        $response = $this->archive(2, true);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertTrue($this->json($response)['data']['attributes']['canelaArchived']);

        $this->assertSame([10], $this->box(2, 'archive'));
        $this->assertSame([], $this->box(2, 'inbox'));
        $this->assertSame([10], $this->box(3, 'inbox'));
        $this->assertSame([], $this->box(3, 'archive'));
    }

    /**
     * Uma resposta nova tira a conversa do arquivo de todos.
     */
    #[Test]
    public function resposta_tira_do_arquivo(): void
    {
        $this->archive(2, true);

        $this->message(3, ['content' => 'Voltei'], 10);

        $this->assertNull($this->database()->table('dialog_user')->where('dialog_id', 10)->where('user_id', 2)->value('canela_archived_at'));
        $this->assertSame([10], $this->box(2, 'inbox'));
    }

    /**
     * Quem está de fora não arquiva a conversa dos outros.
     */
    #[Test]
    public function estranho_nao_arquiva(): void
    {
        $response = $this->archive(4, true);

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertSame(0, $this->database()->table('dialog_user')->where('dialog_id', 10)->whereNotNull('canela_archived_at')->count());
    }

    /**
     * Caixas "Enviadas" e "Não lidos": enviadas tem mensagem minha; não lida
     * é a já aberta com mensagem depois da última lida.
     */
    #[Test]
    public function caixas_enviadas_e_nao_lidas(): void
    {
        $this->assertSame([10], $this->box(2, 'sent'));
        $this->assertSame([], $this->box(2, 'unread'));
        $this->assertSame([10], $this->box(3, 'unread'));
    }

    /**
     * Mensagem com mais de um destinatário (`canelaUsers`) abre uma conversa
     * de grupo com todos.
     */
    #[Test]
    public function mensagem_para_varias_pessoas_abre_conversa_de_grupo(): void
    {
        $response = $this->message(2, ['content' => 'Para os dois', 'users' => [['id' => 3]], 'canelaUsers' => [4]]);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $dialogId = (int) $this->json($response)['data']['relationships']['dialog']['data']['id'];

        $this->assertNotSame(10, $dialogId);
        $this->assertSame('canela_group', $this->database()->table('dialogs')->where('id', $dialogId)->value('type'));
        $this->assertEqualsCanonicalizing([2, 3, 4], $this->database()->table('dialog_user')->where('dialog_id', $dialogId)->pluck('user_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * Escrever a alguém da equipe leva a conversa para a caixa do grupo da
     * equipe; o membro da equipe a vê "pelo grupo".
     */
    #[Test]
    public function mensagem_a_equipe_vai_para_a_caixa_do_grupo(): void
    {
        $response = $this->message(2, ['content' => 'Ajuda, por favor', 'users' => [['id' => 1]]]);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $dialogId = (int) $this->json($response)['data']['relationships']['dialog']['data']['id'];

        $dialog = $this->database()->table('dialogs')->where('id', $dialogId)->first();
        $this->assertSame('canela_group', $dialog->type);
        $this->assertSame(1, (int) $dialog->canela_group_id);

        $this->assertSame([$dialogId], $this->box(1, 'group'));
        $this->assertNotContains($dialogId, $this->box(1, 'inbox'));
    }

    /**
     * As contagens de mensagens do perfil só aparecem para a própria pessoa.
     */
    #[Test]
    public function contagens_do_perfil_so_para_a_propria_pessoa(): void
    {
        $own = $this->json($this->send($this->request('GET', '/api/users/3', ['authenticatedAs' => 3])));
        $this->assertSame(['new' => 0, 'unread' => 1, 'group' => 0], $own['data']['attributes']['canelaDialogCounts']);

        $other = $this->json($this->send($this->request('GET', '/api/users/3', ['authenticatedAs' => 2])));
        $this->assertArrayNotHasKey('canelaDialogCounts', $other['data']['attributes']);
    }
}
