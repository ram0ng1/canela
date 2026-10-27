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

namespace Ramon\Canela\Chat\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint\Endpoint;
use Flarum\User\User;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Support\NullOrder;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * `GET /api/users/canela-chat-search?filter[q]=…[&filter[channel]=…]`: a busca de pessoas do
 * chat — o autocompletar do `@` e o seletor de "Nova mensagem".
 *
 * Um endpoint no recurso `users` do core, e não o índice dele: o índice exige
 * a permissão de procurar usuários, e quem pode conversar precisa achar com
 * quem conversar. Por isso só por prefixo do nome de usuário, só quem pode
 * usar o chat e no máximo 10 resultados. Com `channel`, `meta.memberIds` diz
 * quem é membro (o aviso "não participa do canal"), e os membros vêm primeiro.
 */
final class UserSearch
{
    private const LIMIT = 10;

    public static function endpoint(): Endpoint
    {
        return Endpoint::make('canela.chatSearch')
            ->route('GET', '/canela-chat-search')
            ->authenticated()
            ->action(static function (Context $context): array {
                ChatGate::check($context);
                $actor = $context->getActor();
                $access = resolve(ChatAccess::class);
                $params = ChannelEndpoints::filter($context);

                $term = ltrim(trim(is_scalar($params['q'] ?? null) ? (string) $params['q'] : ''), '@');

                // Com os grupos: a permissão de cada um sai deles, sem uma consulta por pessoa.
                $query = User::query()->with('groups')->where('is_email_confirmed', true)->limit(30);

                // Sem termo (o seletor acabou de abrir), quem esteve por aqui há pouco.
                if ($term !== '') {
                    $query->whereLike('username', addcslashes($term, '\\%_').'%', caseSensitive: false)->orderBy('username');
                } else {
                    NullOrder::orderBy($query, 'last_seen_at', 'desc');
                }

                $users = $query->get()->filter(static fn (User $user) => $access->canUse($user))->values();

                $memberIds = [];
                $channelId = (int) ($params['channel'] ?? 0);

                if ($channelId) {
                    /** @var Channel|null $channel */
                    $channel = Channel::query()->whereVisibleTo($actor)->find($channelId);

                    if (! $channel) {
                        throw new ModelNotFoundException();
                    }

                    $actor->assertCan('view', $channel);

                    $memberIds = Membership::query()
                        ->where('channel_id', $channel->id)
                        ->where('following', true)
                        ->whereIn('user_id', $users->pluck('id')->all() ?: [0])
                        ->pluck('user_id')
                        ->map(static fn ($id) => (int) $id)
                        ->all();

                    $users = $users->sortBy(static fn (User $u) => in_array($u->id, $memberIds, true) ? 0 : 1)->values();
                }

                return ['users' => $users->take(self::LIMIT)->values(), 'memberIds' => $memberIds];
            })
            ->response(static fn (Context $context, array $result) => ChatDocument::collection($context, 'users', $result['users'], [], [
                'memberIds' => $result['memberIds'],
            ]));
    }
}
