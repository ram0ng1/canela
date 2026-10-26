<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration;

use Flarum\Discussion\Discussion;
use Flarum\Post\Post;

/**
 * Para os testes que dependem da busca de texto do core: no MySQL/MariaDB ela
 * usa o índice FULLTEXT, que o InnoDB só atualiza no commit, então os tópicos
 * e posts gravados dentro da transação do teste nunca seriam achados.
 *
 * Como o core faz (tests/integration/api/discussions/ListWithFulltextSearchTest):
 * nesses bancos, os tópicos e posts do prepareDatabase() são gravados fora da
 * transação e apagados no tearDown; o resto continua dentro dela. Nos outros
 * bancos nada muda.
 */
trait CommitsSearchableContent
{
    /** @var array{discussions: int[], posts: int[]}|null */
    private ?array $committedSearchable = null;

    /** Chamar no setUp, depois do prepareDatabase() e do extension(). */
    protected function commitSearchableContent(): void
    {
        if (! in_array($this->database()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $discussions = $this->rowsThroughFactory(Discussion::class, $this->databaseContent[Discussion::class] ?? []);
        $posts = $this->rowsThroughFactory(Post::class, $this->databaseContent[Post::class] ?? []);
        unset($this->databaseContent[Discussion::class], $this->databaseContent[Post::class]);

        $db = $this->database();
        $db->rollBack();

        $schema = $db->getSchemaBuilder();
        $schema->disableForeignKeyConstraints();
        $db->table('discussions')->insert($discussions);
        $db->table('posts')->insert($posts);
        $schema->enableForeignKeyConstraints();

        $this->committedSearchable = [
            'discussions' => array_column($discussions, 'id'),
            'posts' => array_column($posts, 'id'),
        ];

        // A transação do app foi desfeita: começa outra e grava o resto.
        $db->beginTransaction();
        $this->populateDatabase();
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        if ($this->committedSearchable !== null) {
            $db = $this->database();
            $schema = $db->getSchemaBuilder();
            $schema->disableForeignKeyConstraints();
            $db->table('posts')->whereIn('id', $this->committedSearchable['posts'])->delete();
            $db->table('discussions')->whereIn('id', $this->committedSearchable['discussions'])->delete();
            $schema->enableForeignKeyConstraints();
        }
    }
}
