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
use Ramon\Canela\Ai\TopicSummary;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;

/**
 * Os resumos de IA dos tópicos: ler o pronto (`GET /api/canela-ai-summaries/{id}`,
 * qualquer um que veja o tópico) e gerar (`POST /api/canela/ai/summaries/{id}`,
 * em streaming, com a permissão `canela.generateAiSummaries`).
 *
 * Tópicos: 1 com resumo em dia; 2 com resumo desatualizado (chegaram duas
 * postagens); 3 sem resumo, com três postagens; 4 oculto, com resumo; 5 com
 * uma postagem só.
 */
class SummariesTest extends AbstractAiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $now = Carbon::now();
        $discussion = fn (int $id, int $last, array $extra = []) => $extra + [
            'id' => $id, 'title' => "Tópico $id", 'user_id' => 3, 'created_at' => $now, 'last_posted_at' => $now,
            'comment_count' => $last, 'first_post_id' => $id * 10 + 1, 'last_post_number' => $last,
        ];

        $posts = [];
        foreach ([1 => 3, 2 => 5, 3 => 3, 4 => 3, 5 => 1] as $id => $count) {
            for ($n = 1; $n <= $count; $n++) {
                $posts[] = ['id' => $id * 10 + $n, 'discussion_id' => $id, 'user_id' => 3, 'type' => 'comment', 'content' => "<t><p>Postagem $n do tópico $id</p></t>", 'number' => $n, 'created_at' => $now];
            }
        }

        $summary = fn (int $id, int $number) => [
            'discussion_id' => $id, 'summary' => "Resumo do tópico $id", 'summary_post_number' => $number, 'summary_post_count' => $number,
            'summary_model' => 'claude-sonnet-5-5', 'summary_updated_at' => $now,
        ];

        $this->prepareDatabase([
            Discussion::class => [
                $discussion(1, 3),
                $discussion(2, 5),
                $discussion(3, 3),
                $discussion(4, 3, ['hidden_at' => $now, 'hidden_user_id' => 1]),
                $discussion(5, 1),
            ],
            Post::class => $posts,
            TopicSummary::class => [
                $summary(1, 3),
                $summary(2, 3),
                $summary(4, 3),
                // Só o resumo curto da lista: não conta como resumo.
                ['discussion_id' => 3, 'summary' => null, 'gist' => 'Uma frase', 'gist_post_number' => 3],
            ],
        ]);
    }

    private function show(int $id, ?int $as = null)
    {
        return $this->send($this->request('GET', "/api/canela-ai-summaries/$id", $as ? ['authenticatedAs' => $as] : []));
    }

    private function generate(int $id, array $json = [], int $as = 2)
    {
        return $this->send($this->request('POST', "/api/canela/ai/summaries/$id", ['authenticatedAs' => $as, 'json' => $json]));
    }

    /** Qualquer um que veja o tópico, visitante incluído, lê o resumo pronto. */
    #[Test]
    public function visitante_le_o_resumo_pronto(): void
    {
        $response = $this->show(1);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $data = $this->body($response)['data'];

        $this->assertSame('canela-ai-summaries', $data['type']);
        $this->assertSame('1', $data['id']);
        $this->assertSame('Resumo do tópico 1', $data['attributes']['text']);
        $this->assertSame('claude-sonnet-5-5', $data['attributes']['model']);
        $this->assertFalse($data['attributes']['outdated']);
        $this->assertSame(0, $data['attributes']['newPostsSinceSummary']);
        $this->assertFalse($data['attributes']['canRegenerate']);
        $this->assertNotNull($data['attributes']['updatedAt']);
    }

    /** Desatualizado: quantas postagens faltam, e "Gerar novamente" só para quem tem a permissão. */
    #[Test]
    public function resumo_desatualizado(): void
    {
        $guest = $this->body($this->show(2))['data']['attributes'];

        $this->assertTrue($guest['outdated']);
        $this->assertSame(2, $guest['newPostsSinceSummary']);
        $this->assertFalse($guest['canRegenerate']);

        $this->assertTrue($this->body($this->show(2, 2))['data']['attributes']['canRegenerate']);
    }

    /**
     * Sem a permissão de gerar, o resumo desatualizado continua legível, só
     * sem o "Gerar novamente". (As permissões ficam em cache por processo:
     * por isso a revogação vem antes do primeiro pedido.)
     */
    #[Test]
    public function desatualizado_sem_permissao_nao_regenera(): void
    {
        $this->revoke(AiSettings::SUMMARIZE_PERMISSION);

        $attributes = $this->body($this->show(2, 2))['data']['attributes'];

        $this->assertTrue($attributes['outdated']);
        $this->assertFalse($attributes['canRegenerate']);
    }

    /** Sem resumo (nem tópico, ou só o resumo curto) e tópico que a pessoa não vê: 404. */
    #[Test]
    public function sem_resumo_ou_invisivel_responde_404(): void
    {
        $this->assertEquals(404, $this->show(3)->getStatusCode());
        $this->assertEquals(404, $this->show(5)->getStatusCode());
        $this->assertEquals(404, $this->show(999)->getStatusCode());
        $this->assertEquals(404, $this->show(4)->getStatusCode());
        $this->assertEquals(404, $this->show(4, 2)->getStatusCode());
        // Quem vê o tópico oculto (a moderação) lê o resumo dele.
        $this->assertEquals(200, $this->show(4, 1)->getStatusCode());
    }

    /** Resumos desligados: 404 para ler e para gerar. */
    #[Test]
    public function recurso_desligado_responde_404(): void
    {
        $this->setting(AiSettings::SUMMARY, '0');

        $this->assertEquals(404, $this->show(1)->getStatusCode());
        $this->assertEquals(404, $this->generate(3)->getStatusCode());
    }

    /** Gerar: o texto em streaming, o resumo gravado (com o modelo e a postagem em que parou) e um pedido do limite. */
    #[Test]
    public function gerar_resumo_em_streaming(): void
    {
        FakeLlm::queue('Um resumo novinho.');

        $lines = $this->lines($this->generate(3));

        $this->assertSame(['delta', 'delta', 'summary', 'done'], $this->types($lines));
        $this->assertSame('Um resumo novinho.', $lines[2]['summary']['text']);
        $this->assertFalse($lines[2]['summary']['outdated']);

        $summary = TopicSummary::query()->find(3);

        $this->assertSame('Um resumo novinho.', $summary->summary);
        $this->assertSame(3, $summary->summary_post_number);
        $this->assertSame('Uma frase', $summary->gist);
        $this->assertStringContainsString('Postagem 3 do tópico 3', FakeLlm::$requests[0]->messages[0]['content']);
        $this->assertSame(1, (int) $this->database()->table('canela_ai_usage')->where('user_id', 2)->value('requests'));

        // E agora qualquer um o lê.
        $this->assertEquals(200, $this->show(3)->getStatusCode());
    }

    /** Resumo em dia volta na hora, sem chamar o modelo; o desatualizado só é refeito com `regenerate`. */
    #[Test]
    public function resumo_pronto_nao_chama_o_modelo(): void
    {
        $this->assertSame(['summary', 'done'], $this->types($this->lines($this->generate(1, ['regenerate' => true]))));
        $this->assertSame(['summary', 'done'], $this->types($this->lines($this->generate(2))));
        $this->assertSame([], FakeLlm::$requests);

        FakeLlm::queue('Resumo refeito.');

        $lines = $this->lines($this->generate(2, ['regenerate' => true]));

        $this->assertSame(['delta', 'delta', 'summary', 'done'], $this->types($lines));
        $this->assertSame('Resumo refeito.', $lines[2]['summary']['text']);
        $this->assertSame(5, TopicSummary::query()->find(2)->summary_post_number);
    }

    /** Sem a permissão, quem não tem resumo pronto recebe 403; o pronto continua vindo. */
    #[Test]
    public function sem_permissao_nao_gera(): void
    {
        $this->revoke(AiSettings::SUMMARIZE_PERMISSION);

        $this->assertEquals(403, $this->generate(3)->getStatusCode());
        $this->assertEquals(403, $this->generate(2, ['regenerate' => true])->getStatusCode());
        $this->assertSame(['summary', 'done'], $this->types($this->lines($this->generate(1))));
        $this->assertSame([], FakeLlm::$requests);
        $this->assertNull(TopicSummary::query()->find(3)->summary);
    }

    /** Tópico curto demais (menos postagens que o mínimo do admin) ou invisível: 404. */
    #[Test]
    public function topico_curto_ou_invisivel_responde_404(): void
    {
        $this->assertEquals(404, $this->generate(5)->getStatusCode());
        $this->assertEquals(404, $this->generate(4)->getStatusCode());
        $this->assertEquals(404, $this->generate(999)->getStatusCode());
        $this->assertSame([], FakeLlm::$requests);
    }

    /** `regenerate` precisa ser booleano. */
    #[Test]
    public function regenerate_invalido_responde_422(): void
    {
        $this->assertEquals(422, $this->generate(3, ['regenerate' => 'talvez'])->getStatusCode());
        $this->assertSame([], FakeLlm::$requests);
    }
}
