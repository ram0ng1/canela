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
 * O fundo do fórum e o das páginas de entrar/cadastrar (src/Backgrounds), e
 * o envio da imagem de fundo pelo admin.
 */

use Flarum\Extend;
use Flarum\Settings\SettingsRepositoryInterface;
use Ramon\Canela\Backgrounds\Api\DeleteBackgroundController;
use Ramon\Canela\Backgrounds\Api\UploadBackgroundController;
use Ramon\Canela\Backgrounds\Backgrounds;

$image = static fn ($value): ?string => is_string($value) && $value !== '' ? $value : null;

return [
    (new Extend\Settings())
        ->serializeToForum('canelaForumBackground', Backgrounds::FORUM, static fn ($value): string => Backgrounds::forum(
            $value,
            resolve(SettingsRepositoryInterface::class)->get(Backgrounds::LEGACY_TINTED)
        ))
        ->serializeToForum('canelaAuthBackground', Backgrounds::AUTH, static fn ($value): string => Backgrounds::auth($value))
        ->serializeToForum('canelaForumBackgroundImage', Backgrounds::imageKey('forum'), $image)
        ->serializeToForum('canelaAuthBackgroundImage', Backgrounds::imageKey('auth'), $image),

    (new Extend\Routes('api'))
        ->post('/canela/backgrounds/{target}', 'canela.backgrounds.upload', UploadBackgroundController::class)
        ->delete('/canela/backgrounds/{target}', 'canela.backgrounds.delete', DeleteBackgroundController::class),
];
