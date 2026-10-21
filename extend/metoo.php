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
 * "Me too": o botão
 * "Eu também (N)" com a mão levantada abaixo do primeiro post. As regras
 * moram em Ramon\Canela\MeToo\MeToo; o card fica no grupo "Tópico" do admin.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Extend;
use Ramon\Canela\MeToo\Api\DiscussionMeTooFields;
use Ramon\Canela\MeToo\Api\ToggleMeTooController;
use Ramon\Canela\MeToo\Event\Toggled;
use Ramon\Canela\MeToo\MeToo;
use Ramon\Canela\MeToo\Realtime\BroadcastMeToo;

return [
    (new Extend\Settings())
        ->default(MeToo::ENABLED, true)
        ->default(MeToo::TAGS, '')
        ->default(MeToo::HIDE_SOLVED, true)
        ->default(MeToo::FOLLOW, true)
        ->serializeToForum('canelaMeTooEnabled', MeToo::ENABLED, 'boolval')
        // O fórum precisa saber para esconder o botão na hora em que alguém
        // escolhe a melhor resposta, sem esperar recarregar o tópico.
        ->serializeToForum('canelaMeTooHideSolved', MeToo::HIDE_SOLVED, 'boolval'),

    (new Extend\Routes('api'))
        ->post('/canela-me-too', 'canela.metoo.toggle', ToggleMeTooController::class),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionMeTooFields::class),

    // Tempo real: só com o flarum/realtime, quem está com o tópico aberto vê
    // a contagem mudar sem recarregar. Sem ele o ouvinte nem é registrado.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-realtime', static fn (): array => [
            (new Extend\Event())->listen(Toggled::class, BroadcastMeToo::class),
        ]),
];
