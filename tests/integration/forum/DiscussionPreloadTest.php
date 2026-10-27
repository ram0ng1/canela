<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\forum;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Preload\PreloadKey;

/**
 * Os tópicos sugeridos do fim da discussão vêm com a página nas discussões
 * curtas (`canelaPreload`), com os mesmos parâmetros do `SuggestedTopics.tsx`
 * — a chave é o pedido. Nas longas o fim só aparece rolando, e nada vem.
 *
 * A discussão 1 (2 posts) está na subcategoria "sub" (filha de "geral") e
 * nas etiquetas "zeta" e "alfa"; a 2 tem 25 posts.
 */
class DiscussionPreloadTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ramon-canela');

        $now = Carbon::now();
        $posts = [
            ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Oi</t>', 'number' => 1, 'created_at' => $now],
            ['id' => 2, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Olá</t>', 'number' => 2, 'created_at' => $now],
        ];

        for ($number = 1; $number <= 25; $number++) {
            $posts[] = ['id' => 100 + $number, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'content' => "<t>Post $number</t>", 'number' => $number, 'created_at' => $now];
        }

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            Tag::class => [
                ['id' => 1, 'name' => 'Geral', 'slug' => 'geral', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Sub', 'slug' => 'sub', 'position' => 0, 'parent_id' => 1],
                ['id' => 3, 'name' => 'Zeta', 'slug' => 'zeta', 'position' => null, 'parent_id' => null],
                ['id' => 4, 'name' => 'Alfa', 'slug' => 'alfa', 'position' => null, 'parent_id' => null],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Curta', 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 2, 'first_post_id' => 1, 'last_post_id' => 2, 'last_post_number' => 2],
                ['id' => 2, 'title' => 'Longa', 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 25, 'first_post_id' => 101, 'last_post_id' => 125, 'last_post_number' => 25],
            ],
            Post::class => $posts,
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 1],
                ['discussion_id' => 1, 'tag_id' => 2],
                ['discussion_id' => 1, 'tag_id' => 3],
                ['discussion_id' => 1, 'tag_id' => 4],
                ['discussion_id' => 2, 'tag_id' => 1],
            ],
        ]);
    }

    /**
     * Cada lista pré-carregada é um pedido próprio à API, que carrega os
     * autores (e os grupos deles) das discussões — o mesmo que os pedidos do
     * navegador fariam, um a um, depois da página. Um número fixo e pequeno
     * (as duas listas), que não cresce com os dados.
     */
    protected function allowedRepeatedQueries(): array
    {
        return ['users"."id" in', 'users`.`id` in', 'group_user" on', 'group_user` on'];
    }

    /** As chaves de `canelaPreload` da página. */
    private function preloaded(string $path, string $userAgent = self::BROWSER): array
    {
        $response = $this->send($this->request('GET', $path)->withHeader('User-Agent', $userAgent));

        $this->assertEquals(200, $response->getStatusCode());

        preg_match('#<script id="flarum-json-payload" type="application/json">(.*?)</script>#s', (string) $response->getBody(), $match);
        $payload = json_decode(html_entity_decode($match[1] ?? '{}'), true);

        return array_keys($payload['canelaPreload'] ?? []);
    }

    private function include(): string
    {
        return 'tags,user,lastPostedUser';
    }

    /**
     * Na discussão curta vêm "Sugestões" (a subcategoria, a mais específica)
     * e "Relacionado(a)" pelas etiquetas, em ordem alfabética.
     */
    #[Test]
    public function discussao_curta_traz_as_sugestoes(): void
    {
        $keys = $this->preloaded('/d/1');

        $this->assertContains(PreloadKey::make('/discussions', [
            'sort' => '-lastPostedAt', 'page' => ['limit' => 6], 'include' => $this->include(), 'filter' => ['tag' => 'sub'],
        ]), $keys);

        $this->assertContains(PreloadKey::make('/discussions', [
            'sort' => '-commentCount', 'filter' => ['tag' => 'alfa,zeta'], 'page' => ['limit' => 10], 'include' => $this->include(),
        ]), $keys);
    }

    /**
     * A quantidade do admin muda o pedido do mesmo jeito que no front.
     */
    #[Test]
    public function quantidade_do_admin_entra_no_pedido(): void
    {
        $this->setting('canela.suggested_count', '3');

        $this->assertContains(PreloadKey::make('/discussions', [
            'sort' => '-lastPostedAt', 'page' => ['limit' => 4], 'include' => $this->include(), 'filter' => ['tag' => 'sub'],
        ]), $this->preloaded('/d/1'));
    }

    /**
     * Na discussão longa o fim não aparece ao abrir: nada de sugestões.
     */
    #[Test]
    public function discussao_longa_nao_pre_carrega(): void
    {
        foreach ($this->preloaded('/d/2') as $key) {
            $this->assertStringStartsNotWith('discussions?', $key);
        }
    }

    #[Test]
    public function sugestoes_desligadas_nao_pre_carregam(): void
    {
        $this->setting('canela.suggested_topics', '0');

        $this->assertSame([], $this->preloaded('/d/1'));
    }

    /**
     * Robô não roda o JS: nada é pré-carregado para ele.
     */
    #[Test]
    public function robo_nao_recebe_pre_carregamento(): void
    {
        $this->assertSame([], $this->preloaded('/d/1', 'Googlebot/2.1 (+http://www.google.com/bot.html)'));
    }
}
