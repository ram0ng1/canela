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
 * As abas das preferências (`/u/{username}/preferences/{tab}`). Só a rota do
 * documento: o conteúdo é o SettingsPage do core,
 * dividido em abas no JS. `/u/{username}/preferences` sem aba já é atendida
 * pela rota do perfil do core (`/u/{username}[/{filter}]`).
 */

use Flarum\Extend;
use Flarum\Forum\Content\AssertRegistered;

return [
    (new Extend\Frontend('forum'))
        // Como o `/settings` do core: visitante vai para o login.
        ->route('/u/{username}/preferences/{tab:[a-z-]+}', 'canela.user.preferences.tab', AssertRegistered::class),
];
