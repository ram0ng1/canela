<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Gaps;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * O ponto de novidades por categoria (`canelaHasUnread` nas tags): acende
 * com tópico recente não lido, a mãe junto da filha, apaga depois de lido e
 * não existe para visitantes nem com a chave desligada.
 */
class UnreadTagsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser() + ['joined_at' => Carbon::now()->subMonth()],
            ],
            Tag::class => [
                ['id' => 1, 'name' => 'Mãe', 'slug' => 'mae', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Filha', 'slug' => 'filha', 'position' => 0, 'parent_id' => 1],
                ['id' => 3, 'name' => 'Lida', 'slug' => 'lida', 'position' => 1, 'parent_id' => null],
                ['id' => 4, 'name' => 'Velha', 'slug' => 'velha', 'position' => 2, 'parent_id' => null],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Novo', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 1, 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1],
                ['id' => 2, 'title' => 'Já lido', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 1, 'first_post_id' => 2, 'comment_count' => 1, 'last_post_number' => 1],
                ['id' => 3, 'title' => 'Antigo', 'created_at' => Carbon::now()->subDays(30), 'last_posted_at' => Carbon::now()->subDays(30), 'user_id' => 1, 'first_post_id' => 3, 'comment_count' => 1, 'last_post_number' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => Carbon::now(), 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>a</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 2, 'created_at' => Carbon::now(), 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>b</p></t>', 'number' => 1],
                ['id' => 3, 'discussion_id' => 3, 'created_at' => Carbon::now()->subDays(30), 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>c</p></t>', 'number' => 1],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 2],
                ['discussion_id' => 2, 'tag_id' => 3],
                ['discussion_id' => 3, 'tag_id' => 4],
            ],
            'discussion_user' => [
                ['discussion_id' => 2, 'user_id' => 2, 'last_read_post_number' => 1],
            ],
        ]);
    }

    /** @return array<string, array<string, mixed>> atributos de cada tag, pelo slug */
    private function tags(?int $actor): array
    {
        $response = $this->send($this->request('GET', '/api/tags', $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $tags = [];

        foreach (json_decode((string) $response->getBody(), true)['data'] as $tag) {
            $tags[$tag['attributes']['slug']] = $tag['attributes'];
        }

        return $tags;
    }

    /**
     * Tópico recente e não lido acende a categoria filha e a mãe; o lido e o
     * de mais de duas semanas não acendem.
     */
    #[Test]
    public function acende_categorias_com_novidade(): void
    {
        $tags = $this->tags(2);

        $this->assertTrue($tags['filha']['canelaHasUnread']);
        $this->assertTrue($tags['mae']['canelaHasUnread']);
        $this->assertFalse($tags['lida']['canelaHasUnread']);
        $this->assertFalse($tags['velha']['canelaHasUnread']);
    }

    /**
     * "Marcar tudo como lido" apaga os pontos.
     */
    #[Test]
    public function marcar_tudo_como_lido_apaga(): void
    {
        $this->database()->table('users')->where('id', 2)->update(['marked_all_as_read_at' => Carbon::now()->addMinute()]);

        $tags = $this->tags(2);

        $this->assertFalse($tags['filha']['canelaHasUnread']);
        $this->assertFalse($tags['mae']['canelaHasUnread']);
    }

    /**
     * Visitante não tem estado de leitura: o campo nem vem.
     */
    #[Test]
    public function visitante_nao_recebe_o_campo(): void
    {
        $tags = $this->tags(null);

        $this->assertArrayNotHasKey('canelaHasUnread', $tags['filha']);
    }

    /**
     * Com a chave canela.sidebar_category_dots desligada, o campo some.
     */
    #[Test]
    public function chave_desligada_esconde_o_campo(): void
    {
        $this->setting('canela.sidebar_category_dots', false);

        $tags = $this->tags(2);

        $this->assertArrayNotHasKey('canelaHasUnread', $tags['filha']);
    }
}
