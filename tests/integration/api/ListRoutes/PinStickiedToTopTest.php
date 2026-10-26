<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\ListRoutes;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Tests\integration\CommitsSearchableContent;

/**
 * Fixados no topo (com o flarum/sticky): na lista padrão e na "Recentes"
 * (`sort=-lastPostedAt`), da inicial e da tag, os fixados sobem em ordem de
 * criação e o resto segue pela última atividade. Outras ordenações não
 * fixam, a paginação não repete nem perde tópicos e a união não vaza
 * fixados ocultos.
 *
 * Cenário:
 * - 1: fixado, criado há 5 dias (tag geral);
 * - 2: fixado, criado há 10 dias;
 * - 3: comum, atividade há 10 min (tag geral, 5 comentários);
 * - 4: comum, atividade há 2 h (tag geral);
 * - 5: fixado e oculto, o mais antigo.
 */
class PinStickiedToTopTest extends TestCase
{
    use CommitsSearchableContent;
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'flarum-sticky', 'ramon-canela');

        $now = Carbon::now();
        $discussion = fn (int $id, int $createdDays, Carbon $last, array $extra = []) => $extra + [
            'id' => $id, 'title' => "Tópico $id", 'user_id' => 1, 'created_at' => $now->copy()->subDays($createdDays),
            'last_posted_at' => $last, 'comment_count' => 1, 'first_post_id' => $id, 'last_post_number' => 1, 'is_sticky' => 0,
        ];

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            Tag::class => [
                ['id' => 1, 'name' => 'Geral', 'slug' => 'geral', 'position' => 0],
            ],
            Discussion::class => [
                $discussion(1, 5, $now->copy()->subHour(), ['is_sticky' => 1]),
                $discussion(2, 10, $now->copy()->subDays(3), ['is_sticky' => 1]),
                $discussion(3, 1, $now->copy()->subMinutes(10), ['comment_count' => 5]),
                $discussion(4, 2, $now->copy()->subHours(2)),
                $discussion(5, 20, $now, ['is_sticky' => 1, 'hidden_at' => $now]),
            ],
            Post::class => array_map(fn (int $id) => ['id' => $id, 'discussion_id' => $id, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>x</t>', 'number' => 1, 'created_at' => $now], [1, 2, 3, 4, 5]),
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 1],
                ['discussion_id' => 3, 'tag_id' => 1],
                ['discussion_id' => 4, 'tag_id' => 1],
            ],
        ]);
    }

    private function ids(array $query, int $as = 2): array
    {
        $response = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => $as])->withQueryParams($query));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return array_map('intval', array_column(json_decode((string) $response->getBody(), true)['data'], 'id'));
    }

    /**
     * Ordenação padrão (fixando todos, não só os não lidos): fixados em ordem
     * de criação, depois por atividade.
     */
    #[Test]
    public function lista_padrao_fixa_em_ordem_de_criacao(): void
    {
        // Com "só os não lidos", a ordenação padrão fica com o flarum/sticky.
        $this->setting('flarum-sticky.only_sticky_unread_discussions', false);

        $this->assertSame([2, 1, 3, 4], $this->ids([]));
    }

    /**
     * Com "fixar só os não lidos", a ordenação padrão é a do flarum/sticky
     * (o tema não mexe na união dele): os fixados não lidos sobem.
     */
    #[Test]
    public function lista_padrao_com_so_nao_lidos_fica_com_o_sticky(): void
    {
        $this->setting('flarum-sticky.only_sticky_unread_discussions', true);

        $ids = $this->ids([]);

        $this->assertEqualsCanonicalizing([1, 2], array_slice($ids, 0, 2));
        $this->assertSame([3, 4], array_slice($ids, 2));
    }

    /**
     * A aba "Recentes" pede `-lastPostedAt` explícito e também fixa.
     */
    #[Test]
    public function recentes_tambem_fixa(): void
    {
        $this->assertSame([2, 1, 3, 4], $this->ids(['sort' => '-lastPostedAt']));
    }

    /** A pessoa 2 já leu o fixado 1 até o fim. */
    private function readStickyOne(): void
    {
        $this->prepareDatabase([
            'discussion_user' => [
                ['discussion_id' => 1, 'user_id' => 2, 'last_read_post_number' => 1, 'last_read_at' => Carbon::now()],
            ],
        ]);
    }

    /**
     * "Recentes" com "fixar só os não lidos" (o padrão do flarum/sticky): o
     * fixado já lido não sobe, fica no lugar da atividade — a mesma regra da
     * ordenação padrão, que o flarum/sticky aplica sozinho.
     */
    #[Test]
    public function recentes_com_so_nao_lidos_nao_fixa_os_lidos(): void
    {
        $this->setting('flarum-sticky.only_sticky_unread_discussions', true);
        $this->readStickyOne();

        $this->assertSame([2, 3, 1, 4], $this->ids(['sort' => '-lastPostedAt']));

        $first = $this->ids(['sort' => '-lastPostedAt', 'page' => ['limit' => 2, 'offset' => 0]]);
        $second = $this->ids(['sort' => '-lastPostedAt', 'page' => ['limit' => 2, 'offset' => 2]]);

        $this->assertSame([2, 3], $first);
        $this->assertSame([1, 4], $second);
    }

    /**
     * "Marcar tudo como lido" depois da última atividade dos fixados: nenhum
     * é mais não lido, e nenhum sobe.
     */
    #[Test]
    public function recentes_depois_de_marcar_tudo_como_lido_nao_fixa(): void
    {
        $this->setting('flarum-sticky.only_sticky_unread_discussions', true);
        $this->database()->table('users')->where('id', 2)->update(['marked_all_as_read_at' => Carbon::now()->addMinute()]);

        $this->assertSame([3, 1, 4, 2], $this->ids(['sort' => '-lastPostedAt']));
    }

    /**
     * Fixando todos (sem "só os não lidos"), o fixado lido sobe também.
     */
    #[Test]
    public function recentes_fixando_todos_fixa_os_lidos(): void
    {
        $this->setting('flarum-sticky.only_sticky_unread_discussions', false);
        $this->readStickyOne();

        $this->assertSame([2, 1, 3, 4], $this->ids(['sort' => '-lastPostedAt']));
    }

    /**
     * Na página da tag, os fixados sempre sobem (como no flarum/sticky),
     * lidos ou não.
     */
    #[Test]
    public function pagina_da_tag_fixa_mesmo_lido(): void
    {
        $this->setting('flarum-sticky.only_sticky_unread_discussions', true);
        $this->readStickyOne();

        $this->assertSame([1, 3, 4], $this->ids(['filter' => ['tag' => 'geral'], 'sort' => '-lastPostedAt']));
    }

    /**
     * Outra ordenação (ex.: mais respostas) não fixa nada.
     */
    #[Test]
    public function outra_ordenacao_nao_fixa(): void
    {
        $ids = $this->ids(['sort' => '-commentCount']);

        $this->assertSame(3, $ids[0]);
        $this->assertCount(4, $ids);
    }

    /**
     * A paginação corta a lista já ordenada: páginas seguidas não repetem nem
     * perdem tópicos.
     */
    #[Test]
    public function paginacao_nao_repete_nem_perde(): void
    {
        $first = $this->ids(['sort' => '-lastPostedAt', 'page' => ['limit' => 2, 'offset' => 0]]);
        $second = $this->ids(['sort' => '-lastPostedAt', 'page' => ['limit' => 2, 'offset' => 2]]);

        $this->assertSame([2, 1], $first);
        $this->assertSame([3, 4], $second);
    }

    /**
     * Na página da tag, só os fixados da tag sobem.
     */
    #[Test]
    public function pagina_da_tag_fixa_os_da_tag(): void
    {
        $this->assertSame([1, 3, 4], $this->ids(['filter' => ['tag' => 'geral'], 'sort' => '-lastPostedAt']));
    }

    /**
     * Fixado oculto não vaza pela união para quem não pode vê-lo; o admin o
     * vê no lugar dele (o fixado criado primeiro).
     */
    #[Test]
    public function fixado_oculto_nao_vaza(): void
    {
        $this->assertNotContains(5, $this->ids(['sort' => '-lastPostedAt']));
        $this->assertSame([5, 2, 1, 3, 4], $this->ids(['sort' => '-lastPostedAt'], 1));
    }

    /**
     * Com "não fixar na inicial" do flarum/sticky, a inicial não fixa.
     */
    #[Test]
    public function respeita_nao_fixar_na_inicial(): void
    {
        $this->setting('flarum-sticky.pin_sticky_on_all_discussions', false);

        $this->assertSame([3, 1, 4, 2], $this->ids(['sort' => '-lastPostedAt']));
    }

    /**
     * Uma busca de texto não fixa: a relevância manda.
     */
    #[Test]
    public function busca_nao_fixa(): void
    {
        // A busca de texto do core (FULLTEXT no MySQL) só acha o que foi commitado.
        $this->commitSearchableContent();

        $ids = $this->ids(['filter' => ['q' => 'Tópico']]);

        $this->assertNotContains(5, $ids);
        $this->assertEqualsCanonicalizing([1, 2, 3, 4], $ids);
    }
}
