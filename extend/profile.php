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
 * Perfil estendido: bio, local, site, título, status
 * (emoji + frase + validade), capa e fundo do cartão (envio ou URL) e
 * aniversário. Cada campo liga e desliga no admin; a chave-mestra desliga
 * todos de uma vez.
 */

use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Flarum\Http\UrlGenerator;
use Flarum\User\Event\Deleted;
use Flarum\User\User;
use Ramon\Canela\Profile\Access\ProfilePolicy;
use Ramon\Canela\Profile\Api\ProfileImageEndpoints;
use Ramon\Canela\Profile\Api\UserProfileFields;
use Ramon\Canela\Profile\Listener\DeleteProfileImages;
use Ramon\Canela\Profile\ProfileImageUploader;
use Ramon\Canela\Profile\ProfileSettings;

// Numa closure: o extend.php principal faz `require` deste arquivo no escopo
// dele, e uma variável daqui (`$settings`…) sobrescreveria as de lá.
return (static function (): array {
    $settings = (new Extend\Settings())
        ->default(ProfileSettings::ENABLED, true)
        ->serializeToForum('canelaProfileEnabled', ProfileSettings::ENABLED, 'boolval')
        ->default(ProfileSettings::TITLE_SELF, true)
        ->serializeToForum('canelaProfileTitleSelf', ProfileSettings::TITLE_SELF, 'boolval')
        ->default(ProfileSettings::COVER_UPLOAD, true)
        ->serializeToForum('canelaProfileCoverUpload', ProfileSettings::COVER_UPLOAD, 'boolval')
        ->default(ProfileSettings::BIO_MAX_LENGTH, ProfileSettings::BIO_MAX_LENGTH_DEFAULT)
        ->serializeToForum('canelaProfileBioMaxLength', ProfileSettings::BIO_MAX_LENGTH, 'intval');

    // canela.profile_bio → canelaProfileBio, e assim por diante.
    foreach (ProfileSettings::FIELDS as $field) {
        $key = ProfileSettings::fieldKey($field);
        $settings->default($key, true)->serializeToForum('canelaProfile'.ucfirst($field), $key, 'boolval');
    }

    return [
        $settings,

        (new Extend\Model(User::class))
            ->cast('canela_status_until', 'datetime')
            ->cast('canela_birthday', 'date'),

        (new Extend\User())
            ->registerPreference(UserProfileFields::birthdayYearPreference(), 'boolval', false),

        (new Extend\ApiResource(UserResource::class))
            ->fields(UserProfileFields::class)
            ->endpoints(ProfileImageEndpoints::class),

        (new Extend\Policy())
            ->modelPolicy(User::class, ProfilePolicy::class),

        (new Extend\Filesystem())
            ->disk(ProfileImageUploader::DISK, static fn (Paths $paths, UrlGenerator $url): array => [
                'root' => "$paths->public/assets/canela-covers",
                'url' => $url->to('forum')->path('assets/canela-covers'),
            ]),

        (new Extend\Event())
            ->listen(Deleted::class, DeleteProfileImages::class),
    ];
})();
