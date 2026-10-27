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

namespace Ramon\Canela\Chat\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\Model\Channel;

/**
 * `Channel::whereVisibleTo($actor)`: os canais que existem para o ator — os
 * públicos avulsos, os das tags que ele enxerga e as MDs de que participa.
 *
 * Com o chat desligado no admin, nenhum: o canal pedido pelo id responde 404,
 * como se o chat não existisse. Já "pode usar o chat" fica de fora de
 * propósito: quem não pode encontra o canal e recebe 403 da ChannelPolicy,
 * como antes — o canal existe, a pessoa é que não tem acesso ao chat.
 */
final class ScopeChannelVisibility
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    /** @param Builder<Channel> $query */
    public function __invoke(User $actor, Builder $query): void
    {
        if (! $this->access->settings()->enabled()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $tagIds = $this->access->visibleTagIds($actor);
        $actorId = (int) $actor->id;

        $query->where(static function (Builder $query) use ($tagIds, $actorId) {
            $query->where(static function (Builder $public) use ($tagIds) {
                $public->where('canela_chat_channels.type', Channel::TYPE_PUBLIC);

                if ($tagIds !== null) {
                    $public->where(static function (Builder $tag) use ($tagIds) {
                        $tag->whereNull('canela_chat_channels.tag_id')->orWhereIn('canela_chat_channels.tag_id', $tagIds ?: [0]);
                    });
                }
            })->orWhere(static function (Builder $direct) use ($actorId) {
                $direct->where('canela_chat_channels.type', Channel::TYPE_DIRECT)
                    ->whereExists(static function ($exists) use ($actorId) {
                        $exists->selectRaw('1')
                            ->from('canela_chat_memberships')
                            ->whereColumn('canela_chat_memberships.channel_id', 'canela_chat_channels.id')
                            ->where('canela_chat_memberships.user_id', $actorId);
                    });
            });
        });
    }
}
