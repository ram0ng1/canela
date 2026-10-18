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

namespace Ramon\Canela\Topic\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;

/**
 * "Marcar não lido" do rodapé do tópico (Discourse): `canelaMarkUnread` é
 * o número do último post que passa a contar como lido.
 *
 * O `lastReadPostNumber` do core só anda para a frente (UserState::read
 * ignora números menores), por isso um campo próprio, só de escrita, que
 * grava direto no estado de leitura do ator — e só para trás.
 */
final class DiscussionMarkUnreadField
{
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('canelaMarkUnread')
                ->visible(false)
                ->writable(fn (Discussion $discussion, Context $context) => $context->updating() && ! $context->getActor()->isGuest())
                ->set(function (Discussion $discussion, int $value, Context $context): void {
                    $actor = $context->getActor();

                    $discussion->afterSave(function (Discussion $discussion) use ($actor, $value): void {
                        $state = $discussion->stateFor($actor);
                        $number = max(0, $value);

                        // Só volta: avançar a leitura é trabalho do core.
                        if ($state->exists && $number < (int) $state->last_read_post_number) {
                            $state->last_read_post_number = $number;
                            $state->save();
                        }
                    });
                }),
        ];
    }
}
