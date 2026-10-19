<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * O usuário do sistema e as mensagens automáticas, como o `system` e as
 * `system_messages` do Discourse (src/System).
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Http\Middleware\AuthenticateWithHeader;
use Flarum\Http\Middleware\AuthenticateWithSession;
use Flarum\User\User;
use Ramon\Canela\System\Access\SystemPasswordChecker;
use Ramon\Canela\System\Access\SystemUserPolicy;
use Ramon\Canela\System\Api\CreateSystemUserController;
use Ramon\Canela\System\Api\SystemUserPresenter;
use Ramon\Canela\System\Api\UserFields;
use Ramon\Canela\System\Http\RevokeSystemSession;
use Ramon\Canela\System\Listener\BlockRepliesToSystem;
use Ramon\Canela\System\Listener\SendAutoMessages;
use Ramon\Canela\System\Messages\AutoMessages;
use Ramon\Canela\System\SystemDialogs;
use Ramon\Canela\System\SystemUser;

$extenders = [
    // O usuário do sistema não entra: a senha é vetada e qualquer sessão ou
    // token dele (de onde vier) cai na primeira requisição.
    (new Extend\Auth())
        ->addPasswordChecker('canela-system-user', SystemPasswordChecker::class),

    (new Extend\Middleware('forum'))->insertAfter(AuthenticateWithSession::class, RevokeSystemSession::class),
    (new Extend\Middleware('admin'))->insertAfter(AuthenticateWithSession::class, RevokeSystemSession::class),
    (new Extend\Middleware('api'))->insertAfter(AuthenticateWithHeader::class, RevokeSystemSession::class),

    (new Extend\Policy())
        ->modelPolicy(User::class, SystemUserPolicy::class),

    (new Extend\Routes('api'))
        ->post('/canela/system-user', 'canela.system_user.create', CreateSystemUserController::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(UserFields::class),

    // Quem é o usuário do sistema (ou null): o card do admin e o fórum.
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Arr::make('canelaSystemUser')
                ->nullable()
                ->get(function (object $model, Context $context) {
                    $user = resolve(SystemUser::class)->get();

                    return $user ? resolve(SystemUserPresenter::class)->present($user) : null;
                }),
        ]),

    (new Extend\Event())
        ->subscribe(SendAutoMessages::class),
];

$settings = new Extend\Settings();
$settings->default(SystemUser::SETTING, '');

foreach (AutoMessages::TYPES as $type => $definition) {
    $settings
        ->default(AutoMessages::setting($type), $definition['default'])
        ->default(AutoMessages::setting($type, 'subject'), '')
        ->default(AutoMessages::setting($type, 'body'), '');
}

$extenders[] = $settings;

// Respostas à conversa do sistema: só com o flarum/messages. A API recusa a
// resposta, e a conversa já chega ao fórum como "não pode responder".
if (class_exists(\Flarum\Messages\DialogMessage\Event\Creating::class)) {
    $extenders[] = (new Extend\Event())
        ->listen(\Flarum\Messages\DialogMessage\Event\Creating::class, BlockRepliesToSystem::class);

    $extenders[] = (new Extend\ApiResource(\Flarum\Messages\Api\Resource\DialogResource::class))
        ->field('canSendMessage', static fn (Schema\Boolean $field) => $field->get(
            static fn (\Flarum\Messages\Dialog $dialog, Context $context): bool => ! SystemDialogs::involvesSystem($dialog, $context->getActor())
                && \Flarum\Messages\Access\MessagingPermission::canSendIn($context->getActor(), $dialog)
        ));
}

return $extenders;
