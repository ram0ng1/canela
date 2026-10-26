<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Badges;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Events\Dispatcher;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\BadgeAwarded;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\Scope;
use Ramon\Canela\Badges\TrustLevel\TrustLevelChanged;
use Ramon\Canela\Badges\UserBadge;

/**
 * A concessão em si: a carga (fila, trava global, emblema múltiplo sem
 * postagem), as regras de curtida, os eventos da concessão manual e da troca
 * de nível pelo admin, e a limpeza das notificações ao remover um emblema.
 */
class BadgeGrantingTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $likers = array_map(static fn (int $id) => [
            'id' => $id, 'username' => "fa$id", 'email' => "fa$id@machine.local", 'is_email_confirmed' => 1,
        ], range(3, 12));

        $this->prepareDatabase([
            User::class => [
                // Dois anos de casa e uma resposta recente: ganha o Aniversário.
                $this->normalUser() + ['joined_at' => Carbon::now()->subYears(2)->subDay()],
                ...$likers,
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Tópico', 'user_id' => 3, 'first_post_id' => 1, 'comment_count' => 2, 'last_post_number' => 2, 'created_at' => Carbon::now()->subDay()],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>Pergunta</p></t>', 'number' => 1, 'created_at' => Carbon::now()->subDay()],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Resposta</p></t>', 'number' => 2, 'created_at' => Carbon::now()->subHours(20)],
            ],
            'canela_badges' => [
                BadgesTest::badge(102, 'Repetível', ['multiple_grant' => true]),
            ],
        ]);
    }

    private function badge(string $slug): Badge
    {
        return Badge::query()->where('slug', $slug)->firstOrFail();
    }

    private function grants(string $slug, int $userId = 2): int
    {
        return UserBadge::query()->where('badge_id', $this->badge($slug)->id)->where('user_id', $userId)->count();
    }

    /**
     * Duas cargas que leram o banco antes de qualquer uma gravar devolvem a
     * mesma linha do Aniversário (concessão múltipla, sem postagem): o índice
     * único não barra o NULL, e a pessoa ganhava o mesmo aniversário duas
     * vezes. Agora a segunda gravação vê a primeira.
     */
    #[Test]
    public function aniversario_nao_duplica_com_duas_cargas_ao_mesmo_tempo(): void
    {
        $this->app();
        $badge = $this->badge('anniversary');
        $rows = resolve(BadgeQueries::class)->rows($badge, Scope::backfill());

        $this->assertCount(1, $rows);

        $granter = resolve(BadgeGranter::class);
        $this->assertSame(1, $granter->grant($badge, $rows, false));
        $this->assertSame(0, $granter->grant($badge, $rows, false));

        $this->assertSame(1, $this->grants('anniversary'));
    }

    /** Com outra carga em andamento (a trava global), esta é pulada. */
    #[Test]
    public function carga_com_outra_em_andamento_e_pulada(): void
    {
        $this->setting('canela.badges_backfilled_at', (string) time());
        $this->app();

        $store = $this->app()->getContainer()->make(Cache::class)->getStore();
        $other = $store->lock('canela.badge-backfill', 60);
        $this->assertTrue($other->get());

        $this->assertSame(0, resolve(BadgeGranter::class)->backfill());
        $this->assertSame(0, $this->grants('anniversary'));

        $other->release();

        $this->assertGreaterThan(0, resolve(BadgeGranter::class)->backfill());
        $this->assertSame(1, $this->grants('anniversary'));
    }

    /**
     * "Conceder agora" vai para a fila e responde 202; com a fila `sync` (o
     * padrão), a carga roda antes da resposta.
     */
    #[Test]
    public function conceder_agora_vai_para_a_fila(): void
    {
        $this->setting('canela.badges_backfilled_at', (string) time());

        $user = $this->send($this->request('POST', '/api/canela-badges/recalculate', ['authenticatedAs' => 2]));
        $admin = $this->send($this->request('POST', '/api/canela-badges/recalculate', ['authenticatedAs' => 1]));

        $this->assertEquals(403, $user->getStatusCode());
        $this->assertEquals(202, $admin->getStatusCode(), (string) $admin->getBody());
        $this->assertSame(1, $this->grants('anniversary'));
    }

    /**
     * Curtir o próprio post não conta para os emblemas de curtidas (como na
     * "Primeira curtida" e no "Boas-vindas"): 9 curtidas alheias + a do autor
     * não dão a "Resposta interessante" (10).
     */
    #[Test]
    public function curtida_do_proprio_autor_nao_conta(): void
    {
        $this->extension('flarum-likes', 'ramon-canela');
        $now = Carbon::now();
        $this->prepareDatabase([
            'post_likes' => array_map(static fn (int $id) => ['post_id' => 2, 'user_id' => $id, 'created_at' => $now], [2, ...range(3, 11)]),
        ]);

        $this->app();
        $badge = $this->badge('nice_post');
        $queries = resolve(BadgeQueries::class);

        $this->assertSame([], $queries->rows($badge, Scope::backfill()));
        $this->assertSame([], $queries->rows($badge, Scope::posts([2])));

        $this->database()->table('post_likes')->insert(['post_id' => 2, 'user_id' => 12, 'created_at' => $now]);

        $rows = $queries->rows($badge, Scope::posts([2]));
        $this->assertCount(1, $rows);
        $this->assertSame(2, $rows[0]['user_id']);
    }

    /** A concessão manual dispara o BadgeAwarded, como no fof/badges. */
    #[Test]
    public function concessao_manual_dispara_o_evento(): void
    {
        $awarded = [];
        $events = $this->app()->getContainer()->make(Dispatcher::class);
        // Só o ouvinte do teste: o das mensagens automáticas devolve `false`
        // quando não há mensagem para o gatilho, e um `false` interrompe a
        // propagação no Dispatcher do Laravel — este nunca seria chamado.
        $events->forget(BadgeAwarded::class);
        $events->listen(BadgeAwarded::class, function (BadgeAwarded $event) use (&$awarded): void {
            $awarded[] = [$event->badge->id, $event->user->id];
        });

        $response = $this->send($this->request('POST', '/api/canela-user-badges/grant', [
            'authenticatedAs' => 1,
            'json' => ['badgeId' => 102, 'username' => 'normal'],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame([[102, 2]], $awarded);
    }

    /** O nível escolhido pelo admin dispara o TrustLevelChanged, como a promoção automática. */
    #[Test]
    public function nivel_pelo_admin_dispara_o_evento(): void
    {
        $changes = [];
        $events = $this->app()->getContainer()->make(Dispatcher::class);
        $events->forget(TrustLevelChanged::class);
        $events->listen(TrustLevelChanged::class, function (TrustLevelChanged $event) use (&$changes): void {
            $changes[] = [$event->user->id, $event->from, $event->to];
        });

        $response = $this->send($this->request('PATCH', '/api/users/3', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'id' => '3', 'attributes' => ['trustLevel' => 2]]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame([[3, 0, 2]], $changes);
    }

    /**
     * Remover um emblema leva junto as notificações "Ganhou …" dele: as
     * concessões saem pela chave estrangeira (sem passar pelo modelo), e as
     * notificações não têm chave nenhuma.
     */
    #[Test]
    public function remover_emblema_apaga_as_notificacoes(): void
    {
        $this->send($this->request('POST', '/api/canela-user-badges/grant', [
            'authenticatedAs' => 1,
            'json' => ['badgeId' => 102, 'username' => 'normal'],
        ]));

        $notifications = fn () => $this->database()->table('notifications')->where('type', 'canelaBadgeGranted')->where('subject_id', 102)->count();
        $this->assertSame(1, $notifications());

        $response = $this->send($this->request('DELETE', '/api/canela-badges/102', ['authenticatedAs' => 1]));

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());
        // (As concessões saem pela chave estrangeira, que o SQLite dos testes não aplica.)
        $this->assertSame(0, $notifications());
    }
}
