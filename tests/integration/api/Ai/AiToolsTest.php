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
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;

/**
 * O que a IA faz sem modelo guardado, com o provedor falso: o ajudante do
 * editor, os tópicos relacionados (endpoint no recurso de tópicos), o
 * "Testar conexão" do admin e o pedido de traduções — a validação da entrada
 * e quem pode cada um.
 */
class AiToolsTest extends AbstractAiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $now = Carbon::now();

        $this->prepareDatabase([
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 1, 'first_post_id' => 1, 'last_post_number' => 1],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 1, 'first_post_id' => 2, 'last_post_number' => 1, 'hidden_at' => $now, 'hidden_user_id' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>Oi</p></t>', 'number' => 1, 'created_at' => $now],
                ['id' => 2, 'discussion_id' => 2, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>Oi</p></t>', 'number' => 1, 'created_at' => $now],
            ],
        ]);
    }

    private function helper(array $json, int $as = 2)
    {
        return $this->send($this->request('POST', '/api/canela/ai/helper', ['authenticatedAs' => $as, 'json' => $json]));
    }

    /** Sugestão de títulos: JSON comum, com a lista limpa (sem numeração nem aspas). */
    #[Test]
    public function ajudante_sugere_titulos(): void
    {
        FakeLlm::queue("1. \"Primeiro título\"\n2. Segundo título\n- Segundo título");

        $response = $this->helper(['mode' => 'titles', 'text' => 'Meu texto']);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(['titles' => ['Primeiro título', 'Segundo título']], $this->body($response)['data']);
        $this->assertSame('claude-haiku-5-5', FakeLlm::$requests[0]->model);
    }

    /** Modos de texto: a resposta vem em streaming, sem as tags <input> que o modelo às vezes devolve. */
    #[Test]
    public function ajudante_revisa_em_streaming(): void
    {
        FakeLlm::queue('<input>Texto revisado.</input>');

        $lines = $this->lines($this->helper(['mode' => 'proofread', 'text' => 'Texto revizado']));

        $this->assertSame(['delta', 'delta', 'result', 'done'], $this->types($lines));
        $this->assertSame('Texto revisado.', $lines[2]['text']);
    }

    /** Modo desconhecido, texto vazio ou longo demais, prompt personalizado vazio: 422 sem chamar o modelo. */
    #[Test]
    public function ajudante_valida_a_entrada(): void
    {
        $invalid = [
            ['mode' => 'hackear', 'text' => 'x'],
            ['text' => 'x'],
            ['mode' => 'proofread', 'text' => '   '],
            ['mode' => 'proofread', 'text' => str_repeat('a', 20001)],
            ['mode' => 'custom_prompt', 'text' => 'x', 'customPrompt' => '  '],
            ['mode' => 'proofread', 'text' => ['x']],
        ];

        foreach ($invalid as $json) {
            $this->assertEquals(422, $this->helper($json)->getStatusCode(), json_encode($json));
        }

        $this->assertSame([], FakeLlm::$requests);
        $this->assertSame(0, (int) $this->database()->table('canela_ai_usage')->where('user_id', 2)->value('requests'));
    }

    /** Falha do provedor numa sugestão (sem streaming): 422 com a mensagem para quem usa. */
    #[Test]
    public function ajudante_falha_do_provedor_responde_422(): void
    {
        FakeLlm::queue(new LlmException('auth', 'chave errada, detalhe interno'));

        $response = $this->helper(['mode' => 'titles', 'text' => 'Meu texto']);

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertStringNotContainsString('detalhe interno', (string) $response->getBody());
    }

    /** Sem a permissão `canela.useAi`: 403; ajudante desligado: 404. */
    #[Test]
    public function ajudante_pede_permissao_e_recurso_ligado(): void
    {
        $this->revoke(AiSettings::USE_PERMISSION);

        $this->assertEquals(403, $this->helper(['mode' => 'titles', 'text' => 'x'])->getStatusCode());
        $this->assertSame([], FakeLlm::$requests);
    }

    #[Test]
    public function ajudante_desligado_responde_404(): void
    {
        $this->setting(AiSettings::HELPER, '0');

        $this->assertEquals(404, $this->helper(['mode' => 'titles', 'text' => 'x'])->getStatusCode());
    }

    /**
     * Relacionados: o tópico passa pela visibilidade do recurso de tópicos
     * (404 para o oculto); sem vetores ainda, a lista vem vazia.
     */
    #[Test]
    public function relacionados_no_recurso_de_topicos(): void
    {
        $this->setting(AiSettings::RELATED, '1');

        $response = $this->send($this->request('GET', '/api/discussions/1/canela-related'));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(['data' => []], $this->body($response));

        $this->assertEquals(404, $this->send($this->request('GET', '/api/discussions/2/canela-related'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/discussions/999/canela-related'))->getStatusCode());
    }

    /** Relacionados desligados (o padrão): 404. */
    #[Test]
    public function relacionados_desligados_respondem_404(): void
    {
        $this->assertEquals(404, $this->send($this->request('GET', '/api/discussions/1/canela-related'))->getStatusCode());
    }

    /** "Testar conexão": só administradores; cada modelo configurado responde. */
    #[Test]
    public function testar_conexao(): void
    {
        FakeLlm::queue('ok', new LlmException('server', 'Modelo inexistente'));

        $response = $this->send($this->request('POST', '/api/canela/ai/test', ['authenticatedAs' => 1, 'json' => []]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $results = $this->body($response)['data'];

        $this->assertSame(['claude-sonnet-5-5', 'claude-haiku-5-5'], array_column($results, 'target'));
        $this->assertSame([true, false], array_column($results, 'ok'));
        $this->assertSame('Modelo inexistente', $results[1]['message']);

        $this->assertEquals(403, $this->send($this->request('POST', '/api/canela/ai/test', ['authenticatedAs' => 2, 'json' => []]))->getStatusCode());
        $this->assertEquals(422, $this->send($this->request('POST', '/api/canela/ai/test', ['authenticatedAs' => 1, 'json' => ['target' => 'outro']]))->getStatusCode());
    }

    /** Traduções: as listas de ids são validadas; vazias, a resposta vem vazia. */
    #[Test]
    public function traducao_valida_as_listas(): void
    {
        $this->setting(AiSettings::TRANSLATION, '1');

        $translate = fn (array $json) => $this->send($this->request('POST', '/api/canela/ai/translate', ['authenticatedAs' => 2, 'json' => $json]));

        $this->assertEquals(422, $translate(['posts' => 'tudo'])->getStatusCode());
        $this->assertEquals(422, $translate(['discussions' => ['x']])->getStatusCode());

        $empty = $translate([]);

        $this->assertEquals(200, $empty->getStatusCode(), (string) $empty->getBody());
        $this->assertSame(['posts' => [], 'discussions' => []], $this->body($empty));
        $this->assertSame([], FakeLlm::$requests);
    }
}
