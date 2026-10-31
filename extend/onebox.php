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
 * Onebox do GitHub, como o do Discourse: um link do GitHub sozinho numa
 * linha da postagem (arquivo com as linhas, issue, pull request, commit, release ou
 * repositório) vira um cartão. O servidor busca no GitHub, guarda em cache e
 * devolve só texto (GithubOnebox); o fórum desenha o cartão
 * (js/src/forum/features/onebox). O token opcional aumenta o limite da API do
 * GitHub (60 pedidos por hora sem ele) e nunca vai para o fórum.
 */

use Flarum\Extend;
use Ramon\Canela\Onebox\OneboxController;
use Ramon\Canela\Onebox\OneboxServiceProvider;
use Ramon\Canela\Onebox\OneboxSettings;

return [
    (new Extend\Settings())
        ->default(OneboxSettings::GITHUB, true)
        ->default(OneboxSettings::GITHUB_TOKEN, '')
        ->serializeToForum('canelaOneboxGithub', OneboxSettings::GITHUB, 'boolval'),

    (new Extend\ServiceProvider())
        ->register(OneboxServiceProvider::class),

    (new Extend\Routes('api'))
        ->get('/canela/onebox', 'canela.onebox', OneboxController::class),
];
