<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Community;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Group\Group;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * As páginas de grupo (/g e /g/:nome): a lista de membros (o diretório
 * filtrado por grupo), a aba "Atividade" e a contagem de membros — com os
 * grupos ocultos e os pseudo-grupos (Visitantes, Membros) fora do alcance.
 */
class GroupsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            Group::class => [
                ['id' => 5, 'name_singular' => 'Secreto', 'name_plural' => 'Secretos', 'is_hidden' => 1],
                ['id' => 6, 'name_singular' => 'Equipe', 'name_plural' => 'Equipes', 'is_hidden' => 0],
            ],
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'moderadora', 'email' => 'mod@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'agente', 'email' => 'agente@machine.local', 'is_email_confirmed' => 1],
            ],
            'group_user' => [
                ['user_id' => 3, 'group_id' => 4],
                ['user_id' => 3, 'group_id' => 6],
                ['user_id' => 4, 'group_id' => 6],
                ['user_id' => 4, 'group_id' => 5],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 3, 'first_post_id' => 1, 'comment_count' => 2],
                ['id' => 2, 'title' => 'Oculto', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 3, 'first_post_id' => 3, 'comment_count' => 1, 'hidden_at' => Carbon::now()],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => Carbon::now()->subHours(2), 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>a</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 1, 'created_at' => Carbon::now()->subHour(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>b</p></t>', 'number' => 2],
                ['id' => 3, 'discussion_id' => 2, 'created_at' => Carbon::now(), 'user_id' => 4, 'type' => 'comment', 'content' => '<t><p>c</p></t>', 'number' => 1],
            ],
        ]);
    }

    private function members(int $groupId, ?int $actor): ResponseInterface
    {
        $request = $this->request('GET', '/api/canela-directory', $actor ? ['authenticatedAs' => $actor] : []);

        return $this->send($request->withQueryParams(['group' => (string) $groupId]));
    }

    private function activity(int $groupId, ?int $actor): ResponseInterface
    {
        return $this->send($this->request('GET', "/api/canela-groups/$groupId/activity", $actor ? ['authenticatedAs' => $actor] : []));
    }

    private function body(ResponseInterface $response): array
    {
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    /**
     * A lista de membros de um grupo traz só quem está nele, em ordem alfabética.
     */
    #[Test]
    public function lista_os_membros_do_grupo(): void
    {
        $body = $this->body($this->members(6, 2));

        $this->assertSame(['4', '3'], array_column($body['data'], 'user'));
        $this->assertSame('username', $body['meta']['order']);
        $this->assertSame(2, $body['meta']['total']);
    }

    /**
     * Visitantes e Membros não são grupos de verdade: não têm página (404).
     */
    #[Test]
    public function pseudo_grupos_nao_tem_pagina(): void
    {
        $this->assertEquals(404, $this->members(Group::MEMBER_ID, 1)->getStatusCode());
        $this->assertEquals(404, $this->members(Group::GUEST_ID, 1)->getStatusCode());
        $this->assertEquals(404, $this->activity(Group::MEMBER_ID, 1)->getStatusCode());
    }

    /**
     * Grupo oculto: para quem não pode vê-lo, é como se não existisse (404);
     * o admin vê.
     */
    #[Test]
    public function grupo_oculto_responde_404_para_membro(): void
    {
        $this->assertEquals(404, $this->members(5, 2)->getStatusCode());
        $this->assertEquals(404, $this->activity(5, 2)->getStatusCode());

        $this->assertSame(['4'], array_column($this->body($this->members(5, 1))['data'], 'user'));
    }

    /**
     * Os membros de um grupo são uma lista de usuários: visitante sem a
     * liberação do diretório recebe 403.
     */
    #[Test]
    public function visitante_nao_lista_membros(): void
    {
        $this->assertEquals(403, $this->members(6, null)->getStatusCode());
    }

    /**
     * Grupos desligados no admin: lista, atividade e página /g respondem 404.
     */
    #[Test]
    public function grupos_desligados_respondem_404(): void
    {
        $this->setting('canela.groups_enabled', false);

        $this->assertEquals(404, $this->members(6, 1)->getStatusCode());
        $this->assertEquals(404, $this->activity(6, 1)->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/g'))->getStatusCode());
    }

    /**
     * A atividade traz as postagens dos membros, mais novas primeiro, sem as
     * que o ator não vê (tópico oculto).
     */
    #[Test]
    public function atividade_do_grupo_respeita_visibilidade(): void
    {
        $body = $this->body($this->activity(6, 2));

        $this->assertSame(['1'], $body['data']);
        $this->assertFalse($body['meta']['hasMore']);

        // O admin vê o tópico oculto.
        $this->assertSame(['3', '1'], $this->body($this->activity(6, 1))['data']);
    }

    /**
     * Com a aba "Atividade" desligada (canela.groups_activity), 404.
     */
    #[Test]
    public function atividade_desligada_responde_404(): void
    {
        $this->setting('canela.groups_activity', false);

        $this->assertEquals(404, $this->activity(6, 1)->getStatusCode());
    }

    /**
     * Os grupos trazem a contagem de membros para os cartões da página /g.
     */
    #[Test]
    public function grupos_trazem_contagem_de_membros(): void
    {
        $body = $this->body($this->send($this->request('GET', '/api/groups', ['authenticatedAs' => 1])));
        $counts = [];

        foreach ($body['data'] as $group) {
            $counts[$group['id']] = $group['attributes']['canelaMemberCount'] ?? null;
        }

        $this->assertSame(2, $counts['6']);
        $this->assertSame(1, $counts['4']);
        $this->assertSame(1, $counts['1']);
    }

    /**
     * A contagem do cartão bate com a lista de membros: contas não
     * confirmadas e o usuário do sistema ficam de fora das duas.
     */
    #[Test]
    public function contagem_de_membros_segue_a_lista(): void
    {
        $this->prepareDatabase([
            User::class => [
                ['id' => 7, 'username' => 'pendente', 'email' => 'pendente@machine.local', 'is_email_confirmed' => 0],
                ['id' => 8, 'username' => 'system', 'email' => 'system-x@system.invalid', 'is_email_confirmed' => 1],
            ],
            'group_user' => [
                ['user_id' => 7, 'group_id' => 6],
                ['user_id' => 8, 'group_id' => 6],
            ],
        ]);
        $this->setting('canela.system_user_id', '8');

        $members = $this->body($this->members(6, 1));
        $groups = $this->body($this->send($this->request('GET', '/api/groups', ['authenticatedAs' => 1])));
        $count = null;

        foreach ($groups['data'] as $group) {
            if ($group['id'] === '6') {
                $count = $group['attributes']['canelaMemberCount'];
            }
        }

        $this->assertSame(2, $members['meta']['total']);
        $this->assertSame(2, $count);
    }

    /**
     * A aba "Atividade" revela quem está no grupo: pede a mesma permissão da
     * lista de membros. Visitante sem a liberação do diretório recebe 403
     * (antes bastava ver o fórum); com a liberação, vê.
     */
    #[Test]
    public function atividade_exige_poder_listar_usuarios(): void
    {
        $this->assertEquals(403, $this->activity(6, null)->getStatusCode());
        $this->assertEquals(403, $this->members(6, null)->getStatusCode());
    }

    #[Test]
    public function atividade_abre_para_visitante_com_o_diretorio_liberado(): void
    {
        $this->setting('canela.directory_guests', true);

        $this->assertSame(['1'], $this->body($this->activity(6, null))['data']);
    }
}
