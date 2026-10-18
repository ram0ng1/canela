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

namespace Ramon\Canela\RamonChat;

use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Log\LoggerInterface;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Service\MembershipManager;

/**
 * O "Adicionar usuários automaticamente" do Discourse que o ramon/chat só faz
 * em dois momentos (o canal criado, o cadastro): quem ganhou acesso depois —
 * entrou num grupo, a categoria abriu — nunca entrava no canal.
 *
 * Aqui, ao pedir a lista de canais, quem ainda não tem linha num canal
 * `auto_join` que já enxerga entra nele. No máximo uma vez por dia por pessoa
 * (a marca vai para o cache antes do trabalho, para uma falha não repetir a
 * consulta a cada pedido). Quem saiu de um canal tem a linha com `left_at` e
 * não volta: sair foi escolha dela.
 */
final class AutoJoin
{
    private const TTL = 86400;

    /** Teto por rodada: um fórum com centenas de canais automáticos não trava o pedido. */
    private const LIMIT = 30;

    public function __construct(
        private readonly Cache $cache,
        private readonly MembershipManager $memberships,
        private readonly LoggerInterface $log,
    ) {
    }

    public function run(User $actor): void
    {
        if ($actor->isGuest() || ! $actor->hasPermission('ramon-chat.use')) {
            return;
        }

        $key = 'canela.ramonchat.autojoin.'.$actor->id;

        if ($this->cache->get($key)) {
            return;
        }

        $this->cache->put($key, 1, self::TTL);

        try {
            $known = ChannelUser::query()->where('user_id', $actor->id)->select('channel_id');

            $channels = Channel::query()
                // @phpstan-ignore method.notFound (escopo do Flarum)
                ->whereVisibleTo($actor)
                ->where('auto_join', true)
                ->where('type', Channel::TYPE_CATEGORY)
                ->where('status', Channel::STATUS_OPEN)
                ->whereNull('deleted_at')
                ->whereNotIn('id', $known)
                ->limit(self::LIMIT)
                ->get();

            foreach ($channels as $channel) {
                /** @var Channel $channel */
                $this->memberships->join($channel, $actor);
                $channel->refreshMetadata()->save();
            }
        } catch (\Throwable $error) {
            $this->log->warning('[ramon/canela] ramon-chat: auto-join falhou: '.$error->getMessage());
        }
    }
}
