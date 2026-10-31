<?php

declare(strict_types=1);

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
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;

/**
 * A tradução automática vale para as respostas, não só para a primeira
 * postagem: uma resposta que mistura línguas (títulos em português, itens em
 * inglês) vai para a IA, que responde `mul`, e é traduzida para quem lê em
 * inglês.
 */
class TranslationTest extends AbstractAiTestCase
{
    private const PT = 'Olá a todos, eu não consegui entrar no fórum ontem porque a página de login estava com um erro e não carregava de jeito nenhum.';

    private const MIXED = '<r><H2>O que mudou no Tema</H2><LIST><LI>Melhoria (PR #82) por @ramon</LI>'
        .'<LI>Enhance TeamPage and HomePage components (PR #75) por @ramon</LI>'
        .'<LI>Add customizable section titles for homepage settings (PR #79) por @ramon</LI>'
        .'<LI>Integrate realtime updates for discussions and likes (PR #78) por @ramon</LI></LIST>'
        .'<H2>Correções de Erros</H2><LIST><LI>Hide update banner in threads list (PR #84) por @ramon</LI>'
        .'<LI>Version release (PR #81) por @ramon</LI></LIST><H2>Como atualizar</H2></r>';

    protected function setUp(): void
    {
        parent::setUp();

        $this->setting(AiSettings::TRANSLATION, '1');

        $this->prepareDatabase([
            Discussion::class => [['id' => 1, 'title' => 'Tema novo', 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 2, 'last_post_number' => 2, 'created_at' => Carbon::now()]],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'number' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>'.self::PT.'</p></t>', 'created_at' => Carbon::now()],
                ['id' => 2, 'discussion_id' => 1, 'number' => 2, 'user_id' => 2, 'type' => 'comment', 'content' => self::MIXED, 'created_at' => Carbon::now()],
            ],
        ]);
    }

    #[Test]
    public function a_resposta_com_linguas_misturadas_tambem_e_traduzida(): void
    {
        $response = $this->send($this->request('GET', '/api/posts', ['authenticatedAs' => 2, 'queryParams' => ['filter' => ['discussion' => 1]]]));
        $posts = array_column($this->body($response)['data'] ?? [], 'attributes', 'id');

        $this->assertSame('pt', $posts['1']['canelaLocale']);
        $this->assertTrue($posts['1']['canelaTranslatable']);
        // Sem idioma claro: a IA decide no pedido de tradução.
        $this->assertNull($posts['2']['canelaLocale']);
        $this->assertTrue($posts['2']['canelaTranslatable']);

        FakeLlm::queue('{"2": "mul"}', 'Hello everyone, I could not log in.', '## What changed in the theme');

        $response = $this->send($this->request('POST', '/api/canela/ai/translate', ['authenticatedAs' => 2, 'json' => ['posts' => [1, 2]]]));
        $body = $this->body($response);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('pt', $body['posts']['1']['locale']);
        $this->assertSame('mul', $body['posts']['2']['locale']);
        $this->assertStringContainsString('What changed in the theme', $body['posts']['2']['html']);
        $this->assertStringContainsString('"mul"', FakeLlm::$requests[0]->system);

        // A próxima leitura já traz as duas traduções.
        $response = $this->send($this->request('GET', '/api/posts', ['authenticatedAs' => 2, 'queryParams' => ['filter' => ['discussion' => 1]]]));
        $posts = array_column($this->body($response)['data'] ?? [], 'attributes', 'id');

        $this->assertSame('mul', $posts['2']['canelaLocale']);
        $this->assertNotNull($posts['2']['canelaTranslation']);
        $this->assertFalse($posts['2']['canelaTranslatable']);
    }

    /**
     * O modelo devolveu o mesmo texto: fica gravado como "nada a traduzir",
     * e a postagem deixa de vir marcada (antes, cada visita pagava outra chamada).
     */
    #[Test]
    public function traducao_igual_ao_original_nao_e_pedida_de_novo(): void
    {
        FakeLlm::queue(self::PT);

        $body = $this->body($this->send($this->request('POST', '/api/canela/ai/translate', ['authenticatedAs' => 2, 'json' => ['posts' => [1]]])));

        $this->assertSame(['skip' => true], $body['posts']['1']);
        $this->assertCount(1, FakeLlm::$requests);
        $this->assertStringContainsString('Translate this post into English', FakeLlm::$requests[0]->messages[0]['content']);

        $response = $this->send($this->request('GET', '/api/posts', ['authenticatedAs' => 2, 'queryParams' => ['filter' => ['discussion' => 1]]]));
        $posts = array_column($this->body($response)['data'] ?? [], 'attributes', 'id');

        $this->assertFalse($posts['1']['canelaTranslatable']);
        $this->assertNull($posts['1']['canelaTranslation']);

        $this->send($this->request('POST', '/api/canela/ai/translate', ['authenticatedAs' => 2, 'json' => ['posts' => [1]]]));
        $this->assertCount(1, FakeLlm::$requests, 'a segunda vez não chama o modelo');
    }
}
