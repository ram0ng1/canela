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
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\Message;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;

/**
 * A pergunta ao bot (`POST /api/canela/ai/conversations/reply`), com o
 * provedor falso: a resposta em streaming (NDJSON), o que fica gravado, o
 * limite diário e as recusas antes do stream (401, 403, 404, 422).
 */
class ReplyTest extends AbstractAiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $old = Carbon::now()->subDay();

        $this->prepareDatabase([
            Conversation::class => [
                ['id' => 1, 'user_id' => 2, 'title' => 'Minha', 'persona' => 'general', 'message_count' => 2, 'created_at' => $old, 'updated_at' => $old],
                ['id' => 2, 'user_id' => 3, 'title' => 'Da outra', 'persona' => 'general', 'message_count' => 1, 'created_at' => $old, 'updated_at' => $old],
            ],
            Message::class => [
                ['id' => 1, 'conversation_id' => 1, 'role' => 'user', 'content' => 'Primeira pergunta', 'created_at' => $old],
                ['id' => 2, 'conversation_id' => 1, 'role' => 'assistant', 'content' => 'Primeira resposta', 'created_at' => $old],
                ['id' => 3, 'conversation_id' => 2, 'role' => 'user', 'content' => 'Da outra', 'created_at' => $old],
            ],
        ]);
    }

    private function reply(array $json, int $as = 2)
    {
        return $this->send($this->request('POST', '/api/canela/ai/conversations/reply', ['authenticatedAs' => $as, 'json' => $json]));
    }

    private function requestsToday(int $userId): int
    {
        return (int) $this->database()->table('canela_ai_usage')->where('user_id', $userId)->where('day', Carbon::now()->toDateString())->value('requests');
    }

    /**
     * Conversa nova: a conversa, o texto em pedaços, a mensagem gravada, o
     * título (pelo modelo rápido) e o fim do stream; o pedido conta no limite.
     */
    #[Test]
    public function pergunta_nova_abre_conversa_e_responde_em_streaming(): void
    {
        FakeLlm::queue('Olá! Como posso ajudar?', 'Saudação ao bot');

        $response = $this->reply(['message' => '  Oi, bot  ', 'conversationId' => null]);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertStringStartsWith('application/x-ndjson', $response->getHeaderLine('Content-Type'));

        $lines = $this->lines($response);

        $this->assertSame(['conversation', 'delta', 'delta', 'message', 'title', 'done'], $this->types($lines));
        $this->assertTrue($lines[0]['isNew']);
        $this->assertSame('Oi, bot', $lines[0]['userMessage']['content']);
        $this->assertSame('Olá! Como posso ajudar?', $lines[1]['text'].$lines[2]['text']);
        $this->assertSame('Olá! Como posso ajudar?', $lines[3]['message']['content']);
        $this->assertSame('Saudação ao bot', $lines[4]['title']);

        $conversation = Conversation::query()->find((int) $lines[0]['conversation']['id']);

        $this->assertSame(2, $conversation->user_id);
        $this->assertSame('Saudação ao bot', $conversation->title);
        $this->assertSame(2, $conversation->message_count);
        $this->assertSame(['user', 'assistant'], Message::query()->where('conversation_id', $conversation->id)->orderBy('id')->pluck('role')->all());

        // A pergunta foi ao modelo principal; o título, ao rápido.
        $this->assertCount(2, FakeLlm::$requests);
        $this->assertSame('claude-sonnet-5-5', FakeLlm::$requests[0]->model);
        $this->assertSame('claude-haiku-5-5', FakeLlm::$requests[1]->model);
        $this->assertSame(1, $this->requestsToday(2));
    }

    /** Continuar uma conversa manda o histórico ao modelo e não refaz o título. */
    #[Test]
    public function continuar_manda_o_historico(): void
    {
        FakeLlm::queue('Segunda resposta');

        $lines = $this->lines($this->reply(['message' => 'Segunda pergunta', 'conversationId' => 1]));

        $this->assertSame(['conversation', 'delta', 'delta', 'message', 'done'], $this->types($lines));
        $this->assertFalse($lines[0]['isNew']);

        $this->assertCount(1, FakeLlm::$requests);
        $this->assertSame(
            [['role' => 'user', 'content' => 'Primeira pergunta'], ['role' => 'assistant', 'content' => 'Primeira resposta'], ['role' => 'user', 'content' => 'Segunda pergunta']],
            FakeLlm::$requests[0]->messages
        );
        $this->assertSame('Minha', Conversation::query()->find(1)->title);
        $this->assertSame(4, Conversation::query()->find(1)->message_count);
    }

    /** A conversa de outra pessoa não existe para quem pergunta: 404, nada gravado nem gasto. */
    #[Test]
    public function conversa_alheia_responde_404(): void
    {
        $this->assertEquals(404, $this->reply(['message' => 'Invadindo', 'conversationId' => 2])->getStatusCode());
        $this->assertEquals(404, $this->reply(['message' => 'Invadindo', 'conversationId' => 2], 1)->getStatusCode());

        $this->assertSame(1, Message::query()->where('conversation_id', 2)->count());
        $this->assertSame([], FakeLlm::$requests);
        $this->assertSame(0, $this->requestsToday(2));
    }

    /** A pergunta (aparada) tem de 2 a 10 000 caracteres; fora disso, 422 sem gastar o limite. */
    #[Test]
    public function pergunta_invalida_responde_422(): void
    {
        foreach ([['message' => ' a '], ['message' => str_repeat('a', 10001)], [], ['message' => ['x']], ['message' => 'Oi', 'conversationId' => 'abc'], ['message' => 'Oi', 'persona' => ['x']]] as $json) {
            $response = $this->reply($json);

            $this->assertEquals(422, $response->getStatusCode(), json_encode($json));
        }

        $this->assertSame([], FakeLlm::$requests);
        $this->assertSame(0, $this->requestsToday(2));
        $this->assertEquals(200, $this->reply(['message' => 'ok'])->getStatusCode());
    }

    /** Limite diário esgotado: 422 com a mensagem, antes de chamar o modelo. */
    #[Test]
    public function limite_diario_esgotado_responde_422(): void
    {
        $this->setting(AiSettings::DAILY_LIMIT, '1');
        $this->prepareDatabase([
            'canela_ai_usage' => [
                ['user_id' => 2, 'day' => Carbon::now()->toDateString(), 'requests' => 1, 'input_tokens' => 0, 'output_tokens' => 0],
            ],
        ]);

        $response = $this->reply(['message' => 'Mais uma']);

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertSame([], FakeLlm::$requests);

        // O administrador não tem limite.
        $this->assertEquals(200, $this->reply(['message' => 'Mais uma'], 1)->getStatusCode());
    }

    /** Sem a permissão `canela.useAi`: 403, nada gravado. */
    #[Test]
    public function sem_permissao_responde_403(): void
    {
        $this->revoke(AiSettings::USE_PERMISSION);

        $this->assertEquals(403, $this->reply(['message' => 'Oi, bot'])->getStatusCode());
        $this->assertEquals(403, $this->reply(['message' => 'Oi, bot', 'conversationId' => 1])->getStatusCode());
        $this->assertSame(2, Message::query()->where('conversation_id', 1)->count());
        $this->assertSame([], FakeLlm::$requests);
    }

    /** Bot desligado: 404. */
    #[Test]
    public function bot_desligado_responde_404(): void
    {
        $this->setting(AiSettings::BOT, '0');

        $this->assertEquals(404, $this->reply(['message' => 'Oi, bot'])->getStatusCode());
    }

    /**
     * O provedor falhou depois dos cabeçalhos: o erro vira uma linha do stream
     * (com a mensagem para quem usa, sem o texto do provedor) e a pergunta
     * fica gravada.
     */
    #[Test]
    public function falha_do_provedor_vira_linha_de_erro(): void
    {
        FakeLlm::queue(new LlmException('overloaded', 'detalhe interno do provedor'));

        $lines = $this->lines($this->reply(['message' => 'Vai falhar', 'conversationId' => 1]));

        $this->assertSame(['conversation', 'error', 'done'], $this->types($lines));
        $this->assertStringNotContainsString('detalhe interno', $lines[1]['message']);
        $this->assertSame('Vai falhar', Message::query()->where('conversation_id', 1)->orderByDesc('id')->value('content'));
    }
}
