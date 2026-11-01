<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\performance;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

/**
 * Orçamento de queries por endpoint, com o tema e as extensões que ele integra.
 *
 * O número de queries não varia com a máquina, então serve de régua no CI:
 * passar do teto é regressão. O N+1 o TestCase do flarum/testing já pega
 * (20 discussões e 20 primeiros posts passam do limiar dele); aqui fica o
 * custo fixo de cada página. 20 discussões, cada uma com 3 posts.
 */
class EndpointBudgetTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        // Em debug o Flarum recompila os assets a cada página.
        $this->config('debug', false);

        $this->extension(
            'flarum-tags', 'flarum-likes', 'flarum-mentions', 'flarum-sticky', 'flarum-subscriptions',
            'flarum-lock', 'flarum-approval', 'flarum-flags', 'flarum-suspend', 'flarum-messages', 'ramon-canela'
        );

        $now = Carbon::now();
        $users = [$this->normalUser()];
        for ($id = 3; $id <= 6; $id++) {
            $users[] = ['id' => $id, 'username' => "membro$id", 'email' => "membro$id@machine.local", 'is_email_confirmed' => 1];
        }

        $discussions = $posts = $tagged = [];
        for ($d = 1; $d <= 20; $d++) {
            $first = $d * 10;
            $discussions[] = ['id' => $d, 'title' => "Tópico $d", 'user_id' => 2 + $d % 5, 'created_at' => $now, 'last_posted_at' => $now, 'last_posted_user_id' => 1, 'comment_count' => 3, 'participant_count' => 2, 'first_post_id' => $first, 'last_post_id' => $first + 2, 'last_post_number' => 3, 'is_approved' => 1];
            for ($n = 0; $n < 3; $n++) {
                $posts[] = ['id' => $first + $n, 'discussion_id' => $d, 'user_id' => $n ? 1 : 2 + $d % 5, 'type' => 'comment', 'content' => "<t>Post $n do tópico $d</t>", 'number' => $n + 1, 'created_at' => $now, 'is_approved' => 1];
            }
            $tagged[] = ['discussion_id' => $d, 'tag_id' => 1 + $d % 3];
        }

        $this->prepareDatabase([
            User::class => $users,
            Tag::class => [
                ['id' => 1, 'name' => 'Geral', 'slug' => 'geral', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Ajuda', 'slug' => 'ajuda', 'position' => 1, 'parent_id' => null],
                ['id' => 3, 'name' => 'Dicas', 'slug' => 'dicas', 'position' => null, 'parent_id' => null],
            ],
            Discussion::class => $discussions,
            Post::class => $posts,
            'discussion_tag' => $tagged,
        ]);
    }

    /**
     * Endpoint, ator e teto de queries. O teto é o medido no SQLite com o tema
     * mais 2 de folga (os outros bancos variam um pouco). Sem o tema, o core e
     * as extensões fazem de 0 a 8 queries a menos em cada um.
     *
     * @return array<string, array{string, int|null, int}>
     */
    public static function endpoints(): array
    {
        return [
            'home (visitante)' => ['/', null, 15],
            'home (membro)' => ['/', 2, 25],
            'all (membro)' => ['/all', 2, 25],
            'discussão (membro)' => ['/d/1', 2, 50],
            'perfil (membro)' => ['/u/membro3', 2, 14],
            'tags (visitante)' => ['/tags', null, 8],
            'api forum (membro)' => ['/api', 2, 12],
            'api discussions (membro)' => ['/api/discussions?include=user,lastPostedUser,tags,firstPost', 2, 26],
            'api discussions do autor (admin)' => ['/api/discussions?filter[author]=membro3', 1, 17],
            'api busca (membro)' => ['/api/discussions?filter[q]=tópico&include=mostRelevantPost', 2, 20],
            'api discussion (membro)' => ['/api/discussions/1', 2, 23],
            'api posts da discussão (membro)' => ['/api/posts?filter[discussion]=1', 2, 23],
            // Os posts trazem a discussão, que lê o evento: era uma query por discussão.
            'api posts do autor (membro)' => ['/api/posts?filter[author]=admin&include=discussion&sort=-createdAt', 2, 20],
            'api users (admin)' => ['/api/users', 1, 9],
            'api user (membro)' => ['/api/users/3', 2, 6],
            'api groups (membro)' => ['/api/groups', 2, 6],
            'api tags (membro)' => ['/api/tags?include=children,lastPostedDiscussion', 2, 8],
            'api notifications (membro)' => ['/api/notifications', 2, 6],
        ];
    }

    #[Test]
    #[DataProvider('endpoints')]
    public function fica_no_orcamento(string $path, ?int $actor, int $budget): void
    {
        $database = $this->database();
        parse_str((string) parse_url($path, PHP_URL_QUERY), $query);
        $request = $this->request('GET', (string) parse_url($path, PHP_URL_PATH), $actor ? ['authenticatedAs' => $actor] : [])->withQueryParams($query);

        // O primeiro pedido aquece o container e os caches; conta o segundo.
        $this->send($request);
        $database->flushQueryLog();
        $database->enableQueryLog();
        $response = $this->send($request);
        $queries = array_column($database->getQueryLog(), 'query');
        $database->disableQueryLog();

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertLessThanOrEqual($budget + 2, count($queries), "$path passou do orçamento:\n".implode("\n", $queries));
    }
}
