<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Ai;

use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Message;

/**
 * As conversas com o bot (`/api/canela-ai-conversations`): só a dona lista,
 * abre, renomeia e apaga; a de outra pessoa responde 404, até para
 * administradores. Bot desligado: 404; sem a permissão `canela.useAi`: 403.
 */
class ConversationsTest extends AbstractAiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $old = Carbon::now()->subDays(3);

        $this->prepareDatabase([
            Conversation::class => [
                ['id' => 1, 'user_id' => 2, 'title' => 'Mais antiga', 'persona' => 'general', 'message_count' => 2, 'created_at' => $old, 'updated_at' => $old],
                ['id' => 2, 'user_id' => 2, 'title' => 'Mais recente', 'persona' => 'general', 'message_count' => 1, 'created_at' => $old, 'updated_at' => Carbon::now()->subDay()],
                // Nasceu, mas a primeira mensagem não chegou: fora da lista.
                ['id' => 3, 'user_id' => 2, 'title' => null, 'persona' => 'general', 'message_count' => 0, 'created_at' => $old, 'updated_at' => Carbon::now()],
                ['id' => 4, 'user_id' => 3, 'title' => 'Da outra', 'persona' => 'general', 'message_count' => 1, 'created_at' => $old, 'updated_at' => $old],
            ],
            Message::class => [
                ['id' => 2, 'conversation_id' => 1, 'role' => 'assistant', 'content' => 'Resposta', 'tools' => json_encode([['type' => 'search', 'query' => 'x']]), 'model' => 'claude-sonnet-5-5', 'created_at' => $old],
                ['id' => 1, 'conversation_id' => 1, 'role' => 'user', 'content' => 'Pergunta', 'created_at' => $old],
                ['id' => 3, 'conversation_id' => 2, 'role' => 'user', 'content' => 'Outra pergunta', 'created_at' => $old],
                ['id' => 4, 'conversation_id' => 4, 'role' => 'user', 'content' => 'Segredo da outra', 'created_at' => $old],
            ],
        ]);
    }

    private function show(int $id, ?int $as = 2)
    {
        return $this->send($this->request('GET', "/api/canela-ai-conversations/$id", $as ? ['authenticatedAs' => $as] : []));
    }

    private function rename(int $id, mixed $title, int $as = 2)
    {
        return $this->send($this->request('PATCH', "/api/canela-ai-conversations/$id", [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => 'canela-ai-conversations', 'id' => (string) $id, 'attributes' => ['title' => $title]]],
        ]));
    }

    private function delete(int $id, int $as = 2)
    {
        return $this->send($this->request('DELETE', "/api/canela-ai-conversations/$id", ['authenticatedAs' => $as]));
    }

    /** A lista: só as da pessoa, com mensagem, da mais recente para a mais antiga. */
    #[Test]
    public function lista_so_as_proprias_com_mensagem(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $body = $this->body($response);

        $this->assertSame(['2', '1'], array_column($body['data'], 'id'));
        $this->assertSame('canela-ai-conversations', $body['data'][0]['type']);
        $this->assertSame(['title' => 'Mais recente', 'persona' => 'general', 'messageCount' => 1], array_intersect_key($body['data'][0]['attributes'], ['title' => 1, 'persona' => 1, 'messageCount' => 1]));
        $this->assertArrayNotHasKey('next', $body['links'] ?? []);
    }

    /** Páginas de 50, com o `links.next` enquanto houver mais. */
    #[Test]
    public function lista_pagina_de_50_em_50(): void
    {
        $rows = [];
        for ($i = 0; $i < 50; $i++) {
            $rows[] = ['id' => 100 + $i, 'user_id' => 2, 'title' => "Conversa $i", 'persona' => 'general', 'message_count' => 1, 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()->subMinutes($i)];
        }
        $this->prepareDatabase([Conversation::class => $rows]);

        $first = $this->body($this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2])));

        $this->assertCount(50, $first['data']);
        $this->assertSame('100', $first['data'][0]['id']);
        $this->assertArrayHasKey('next', $first['links']);

        $second = $this->body($this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2])->withQueryParams(['page' => ['offset' => 50]])));

        $this->assertSame(['2', '1'], array_column($second['data'], 'id'));
        $this->assertArrayNotHasKey('next', $second['links'] ?? []);
    }

    /** Visitante não tem conversas: a lista pede login. */
    #[Test]
    public function visitante_nao_lista(): void
    {
        $this->assertEquals(401, $this->send($this->request('GET', '/api/canela-ai-conversations'))->getStatusCode());
    }

    /** A conversa vem com as mensagens incluídas, na ordem em que foram escritas. */
    #[Test]
    public function abre_a_conversa_com_as_mensagens_em_ordem(): void
    {
        $response = $this->show(1);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $body = $this->body($response);

        $this->assertSame(['1', '2'], array_column($body['data']['relationships']['messages']['data'], 'id'));

        $messages = array_column($body['included'], null, 'id');

        $this->assertSame('canela-ai-messages', $messages['1']['type']);
        $this->assertSame('user', $messages['1']['attributes']['role']);
        $this->assertSame('Pergunta', $messages['1']['attributes']['content']);
        $this->assertSame([], $messages['1']['attributes']['tools']);
        $this->assertSame([['type' => 'search', 'query' => 'x']], $messages['2']['attributes']['tools']);
        $this->assertSame('claude-sonnet-5-5', $messages['2']['attributes']['model']);
    }

    /** A conversa sem mensagem ainda abre pelo id (só sai da lista). */
    #[Test]
    public function conversa_sem_mensagem_abre_pelo_id(): void
    {
        $this->assertEquals(200, $this->show(3)->getStatusCode());
    }

    /** A de outra pessoa não existe para quem pergunta: 404, também para o administrador e para visitantes. */
    #[Test]
    public function conversa_de_outra_pessoa_responde_404(): void
    {
        $this->assertEquals(404, $this->show(4)->getStatusCode());
        $this->assertEquals(404, $this->show(4, 1)->getStatusCode());
        $this->assertEquals(404, $this->show(1, null)->getStatusCode());
        $this->assertEquals(404, $this->show(999)->getStatusCode());
    }

    /** As mensagens da outra pessoa também não vazam pela lista. */
    #[Test]
    public function administrador_nao_ve_conversas_alheias_na_lista(): void
    {
        $body = $this->body($this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 1])));

        $this->assertSame([], $body['data']);
    }

    /** Renomear apara o título e não sobe a conversa para o topo da lista. */
    #[Test]
    public function renomear_apara_e_nao_mexe_na_data(): void
    {
        $this->app();
        $before = Conversation::query()->find(1)->updated_at->getTimestamp();

        $response = $this->rename(1, '  Novo nome  ');

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('Novo nome', $this->body($response)['data']['attributes']['title']);

        $conversation = Conversation::query()->find(1);

        $this->assertSame('Novo nome', $conversation->title);
        $this->assertSame($before, $conversation->updated_at->getTimestamp());
    }

    /** Título vazio (ou só espaços), nulo ou com mais de 120 caracteres: 422, e nada muda. */
    #[Test]
    public function titulo_invalido_responde_422(): void
    {
        foreach (['', '   ', null, str_repeat('a', 121)] as $title) {
            $response = $this->rename(1, $title);

            $this->assertEquals(422, $response->getStatusCode(), var_export($title, true));
            $this->assertSame('/data/attributes/title', $this->body($response)['errors'][0]['source']['pointer'] ?? null);
        }

        $this->assertSame('Mais antiga', Conversation::query()->find(1)->title);
        $this->assertEquals(200, $this->rename(1, str_repeat('a', 120))->getStatusCode());
    }

    /** Renomear ou apagar a conversa de outra pessoa: 404, e ela fica como estava. */
    #[Test]
    public function nao_mexe_na_conversa_alheia(): void
    {
        $this->assertEquals(404, $this->rename(4, 'Tomada')->getStatusCode());
        $this->assertEquals(404, $this->rename(4, 'Tomada', 1)->getStatusCode());
        $this->assertEquals(404, $this->delete(4)->getStatusCode());
        $this->assertEquals(404, $this->delete(4, 1)->getStatusCode());

        $this->assertSame('Da outra', Conversation::query()->find(4)->title);
        $this->assertSame(1, Message::query()->where('conversation_id', 4)->count());
    }

    /** Apagar leva as mensagens junto. */
    #[Test]
    public function apagar_leva_as_mensagens(): void
    {
        $this->assertEquals(204, $this->delete(1)->getStatusCode());

        $this->assertNull(Conversation::query()->find(1));
        $this->assertSame(0, Message::query()->where('conversation_id', 1)->count());
        $this->assertSame(1, Message::query()->where('conversation_id', 2)->count());
    }

    /** Sem a permissão `canela.useAi`, nem as próprias conversas: 403. */
    #[Test]
    public function sem_permissao_responde_403(): void
    {
        $this->revoke(AiSettings::USE_PERMISSION);

        $this->assertEquals(403, $this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(403, $this->show(1)->getStatusCode());
        $this->assertEquals(403, $this->rename(1, 'X')->getStatusCode());
        $this->assertEquals(403, $this->delete(1)->getStatusCode());
        $this->assertNotNull(Conversation::query()->find(1));

        // O administrador tem toda permissão.
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 1]))->getStatusCode());
    }

    /** Bot desligado no admin: tudo responde 404, como se a rota não existisse. */
    #[Test]
    public function bot_desligado_responde_404(): void
    {
        $this->setting(AiSettings::BOT, '0');

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(404, $this->show(1)->getStatusCode());
        $this->assertEquals(404, $this->rename(1, 'X')->getStatusCode());
        $this->assertEquals(404, $this->delete(1)->getStatusCode());
        $this->assertNotNull(Conversation::query()->find(1));
    }

    /** IA sem provedor configurado: o bot também some. */
    #[Test]
    public function ia_sem_chave_responde_404(): void
    {
        $this->setting(AiSettings::ANTHROPIC_KEY, '');

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-ai-conversations', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(404, $this->show(1)->getStatusCode());
    }
}
