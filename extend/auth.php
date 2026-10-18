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
 * As páginas de entrar e de cadastro do Discourse (/login e /signup): o
 * formulário em página cheia, e não no modal. Só o documento do fórum, sem
 * conteúdo pré-carregado — o JS desenha a página com a lógica dos modais do
 * core (validações, campos de extensões, login social).
 *
 * O core só tem POST /login e POST /register: o GET /login, o /signup e o
 * /forgot-password são livres. O GET /reset/{token} (a página solta do core)
 * vira página do fórum com o mesmo nome de rota, `resetPassword`, que é o que
 * o e-mail de redefinição usa para montar o link; o POST /reset continua o do
 * core. Nada de variáveis soltas: o extend.php faz `require` deste arquivo.
 */

use Flarum\Extend;
use Ramon\Canela\Auth\ResetPasswordContent;

return [
    // O cabeçalho só leva a estas páginas quando este arquivo está carregado
    // (senão um F5 em /login daria 404): o atributo é a prova disso.
    (new Extend\Settings())
        ->default('canela.auth_routes_backend', true)
        ->serializeToForum('canelaAuthRoutes', 'canela.auth_routes_backend', fn () => true),

    (new Extend\Frontend('forum'))
        ->route('/login', 'canela.login')
        ->route('/signup', 'canela.signup')
        ->route('/forgot-password', 'canela.forgot')
        ->removeRoute('resetPassword')
        ->route('/reset/{token}', 'resetPassword', ResetPasswordContent::class),
];
