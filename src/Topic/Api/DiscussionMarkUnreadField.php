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

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Settings\SettingsRepositoryInterface;
use Ramon\Canela\Stats\ReadStateVersion;
use Ramon\Canela\Topic\MarkUnread;

/**
 * "Marcar não lido" do rodapé do tópico: `canelaMarkUnread` é
 * o número do último post que passa a contar como lido.
 *
 * O `lastReadPostNumber` do core só anda para a frente (UserState::read
 * ignora números menores), por isso um campo próprio, só de escrita, que
 * grava direto no estado de leitura do ator — e só para trás.
 *
 * Grava também quando (MarkUnread): sem isso, depois de "marcar tudo como
 * lido" o tópico continuava contando como lido. `canelaMarkedUnreadAt` leva
 * essa data ao JS, que conta o não lido do mesmo jeito.
 */
final class DiscussionMarkUnreadField
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function __invoke(): array
    {
        $ready = MarkUnread::ready($this->settings);

        return [
            Schema\DateTime::make('canelaMarkedUnreadAt')
                ->visible(fn (Discussion $discussion) => $ready && $discussion->state !== null)
                // A coluna não tem cast no modelo do core: vira data aqui, para a API
                // mandar ISO 8601 com fuso (o Safari não lê "2026-10-19 18:54:58").
                ->get(function (Discussion $discussion): ?Carbon {
                    $value = $discussion->state?->getAttribute(MarkUnread::COLUMN);

                    return $value ? Carbon::parse($value) : null;
                }),


            Schema\Integer::make('canelaMarkUnread')
                ->visible(false)
                ->writable(fn (Discussion $discussion, Context $context) => $context->updating() && ! $context->getActor()->isGuest())
                ->set(function (Discussion $discussion, int $value, Context $context) use ($ready): void {
                    $actor = $context->getActor();

                    $discussion->afterSave(function (Discussion $discussion) use ($actor, $value, $ready): void {
                        $state = $discussion->stateFor($actor);
                        // Antes do último comentário, no máximo: a leitura conta os
                        // posts de evento, `last_post_number` só os comentários.
                        $number = max(0, min($value, (int) $discussion->last_post_number - 1));

                        // Só volta: avançar a leitura é trabalho do core.
                        if ($state->exists && $number < (int) $state->last_read_post_number) {
                            $state->last_read_post_number = $number;

                            if ($ready) {
                                $state->setAttribute(MarkUnread::COLUMN, Carbon::now());
                            }

                            $state->save();

                            // As contagens de não lidos dessa pessoa estão em cache: o tópico volta a contar já.
                            resolve(ReadStateVersion::class)->bump((int) $actor->id);
                        }
                    });
                }),
        ];
    }
}
