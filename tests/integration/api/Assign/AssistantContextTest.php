<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Assign;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Assign\AssistantActions;
use Ramon\Canela\Assign\AssistantReplyJob;

/**
 * O que o assistente lê e o que ele pode fazer: o texto do tópico vai para o
 * modelo, então nem as tags restritas que o autor não pode usar nem as
 * postagens que esperam aprovação entram.
 */
class AssistantContextTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'flarum-flags', 'flarum-approval', 'ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
            ],
            Tag::class => [
                ['id' => 1, 'name' => 'Geral', 'slug' => 'geral', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Anúncios', 'slug' => 'anuncios', 'position' => 1, 'parent_id' => null, 'is_restricted' => true],
                ['id' => 3, 'name' => 'Equipe', 'slug' => 'equipe', 'position' => 2, 'parent_id' => null, 'is_restricted' => true],
                ['id' => 4, 'name' => 'Ajuda', 'slug' => 'ajuda', 'position' => 0, 'parent_id' => 2],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Dúvida', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 2, 'last_post_number' => 4],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>primeira</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>esperando aprovação</p></t>', 'number' => 2, 'is_private' => true, 'is_approved' => false],
                ['id' => 3, 'discussion_id' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>ocultada</p></t>', 'number' => 3, 'hidden_at' => Carbon::now()],
                ['id' => 4, 'discussion_id' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>última</p></t>', 'number' => 4],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 3],
            ],
        ]);
    }

    /**
     * As tags abertas e as que o tópico já tem; a restrita que o autor não
     * pode usar fica de fora, e a filha dela também.
     */
    #[Test]
    public function tags_sao_as_que_o_autor_pode_usar(): void
    {
        $this->app();

        $slugs = $this->app()->getContainer()->make(AssistantActions::class)
            ->allowedTags(Discussion::query()->findOrFail(1))
            ->pluck('slug')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['equipe', 'geral'], $slugs);
    }

    /** Sem as ocultas e sem as que esperam aprovação, com a primeira e a última. */
    #[Test]
    public function contexto_so_tem_postagens_publicas(): void
    {
        $this->app();

        $transcript = (fn (Discussion $discussion): string => $this->transcript($discussion))
            ->call(new AssistantReplyJob(1, 2, 4), Discussion::query()->findOrFail(1));

        $this->assertStringContainsString('primeira', $transcript);
        $this->assertStringContainsString('última', $transcript);
        $this->assertStringNotContainsString('esperando aprovação', $transcript);
        $this->assertStringNotContainsString('ocultada', $transcript);
        $this->assertLessThan(strpos($transcript, 'última'), strpos($transcript, 'primeira'));
    }
}
