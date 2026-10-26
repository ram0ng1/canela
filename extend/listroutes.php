<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Os endereços curtos da lista de tópicos:
 *
 * - /latest, /hot, /top, /new e /unread abrem a lista (o JS escolhe a
 *   ordenação pela rota; o documento pré-carregado é o da lista padrão);
 * - /categories abre a página de categorias (o TagsPage carrega as tags);
 * - /c/<slug>[/<id>] redireciona para /t/<slug>.
 *
 * Nada de variáveis soltas: o extend.php faz `require` deste arquivo no
 * próprio escopo.
 */

use Flarum\Extend;
use Flarum\Forum\Content\Index;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Ramon\Canela\ListRoutes\PinStickiedToTop;
use Ramon\Canela\ListRoutes\RedirectCategory;

return [
    // O fórum só leva as abas para estes endereços quando este arquivo está
    // carregado (senão um F5 em /top daria 404): o atributo é a prova disso.
    (new Extend\Settings())
        ->default('canela.list_routes_backend', true)
        ->serializeToForum('canelaListRoutes', 'canela.list_routes_backend', fn () => true),

    (new Extend\Frontend('forum'))
        ->route('/latest', 'canela.latest', Index::class)
        ->route('/hot', 'canela.hot', Index::class)
        ->route('/top', 'canela.top', Index::class)
        ->route('/new', 'canela.new', Index::class)
        ->route('/unread', 'canela.unread', Index::class)
        ->route('/categories', 'canela.categories'),

    (new Extend\Routes('forum'))
        ->get('/c/{path:.+}', 'canela.category_redirect', RedirectCategory::class),

    // Fixados no topo da inicial e da tag, em ordem de criação (ver a classe).
    (new Extend\Conditional())->whenExtensionEnabled('flarum-sticky', fn () => [
        (new Extend\SearchDriver(DatabaseSearchDriver::class))
            ->addMutator(DiscussionSearcher::class, PinStickiedToTop::class),
    ]),
];
