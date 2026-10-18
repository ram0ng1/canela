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

namespace Ramon\Canela\RamonChat\Listener;

use Carbon\Carbon;
use Flarum\Tags\Event\Deleting;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Events\Dispatcher;
use Psr\Log\LoggerInterface;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Channel;
use Ramon\Chat\Event\ChannelWasDeleted;

/**
 * Apagar uma categoria apaga os canais dela, como no Discourse. O ramon/chat
 * deixava o canal órfão (com um `tag_id` que não existe mais), e a regra de
 * visibilidade dele, que segue a tag, deixava de valer.
 *
 * Pelo mesmo caminho do "Excluir canal" do ramon/chat (o Delete do
 * ChannelResource): `deleted_at` + `ChannelWasDeleted`, para os ouvintes dele
 * (tempo real, transferências) fazerem a parte deles e a limpeza agendada
 * levar as mensagens depois.
 */
final class DeleteTagChannels
{
    public function __construct(
        private readonly Container $container,
    ) {
    }

    public function handle(Deleting $event): void
    {
        try {
            if (! $this->container->make(RamonChatSettings::class)->enabled('tag_cleanup')) {
                return;
            }

            $events = $this->container->make(Dispatcher::class);

            $channels = Channel::query()
                ->where('tag_id', $event->tag->id)
                ->whereNull('deleted_at')
                ->get();

            foreach ($channels as $channel) {
                /** @var Channel $channel */
                $channel->deleted_at = Carbon::now();
                $channel->deleted_by_id = $event->actor->id;
                $channel->save();

                $events->dispatch(new ChannelWasDeleted($channel, $event->actor));
            }
        } catch (\Throwable $error) {
            // Apagar a tag nunca pode falhar por causa do chat.
            $this->container->make(LoggerInterface::class)->warning('[ramon/canela] ramon-chat: canais da tag não apagados: '.$error->getMessage());
        }
    }
}
