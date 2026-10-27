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

use Closure;
use Flarum\Api\Context;
use Flarum\User\User;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;

/**
 * Os atributos calculados dos recursos do chat, em lote, para um documento.
 *
 * O campo de um recurso não devolve o valor na hora: registra o modelo aqui e
 * devolve uma closure. O serializador do JSON:API só resolve as closures
 * depois de passar por todos os modelos do nível (as mensagens da página, os
 * canais da barra lateral); a primeira que resolve calcula os atributos de
 * todos os registrados de uma vez (ChatPresenter), e as outras só leem. Um
 * nível novo (o canal incluído de uma mensagem, a original de um fio) é mais
 * um lote — nunca uma consulta por item.
 *
 * Uma instância por documento (presa ao serializador, que some com ele) e
 * por ator.
 */
final class ChatBatch
{
    /** @var \WeakMap<object, self>|null */
    private static ?\WeakMap $documents = null;

    /** @var array<int, Channel> os canais conhecidos, para as mensagens e os fios */
    private array $channelModels = [];

    /** @var array<int, Channel> */
    private array $pendingChannels = [];

    /** @var array<int, Message> */
    private array $pendingMessages = [];

    /** @var array<int, Thread> */
    private array $pendingThreads = [];

    /** @var array<int, array<string, mixed>> */
    private array $channels = [];

    /** @var array<int, array<string, mixed>> */
    private array $messages = [];

    /** @var array<int, array<string, mixed>> */
    private array $threads = [];

    /** @var array<int, User|null> null: procurado, e não existe mais */
    private array $users = [];

    public function __construct(
        private readonly ChatPresenter $presenter,
        private readonly User $actor,
    ) {
    }

    public static function of(Context $context): self
    {
        self::$documents ??= new \WeakMap();
        $key = $context->serializer ?? $context->request;

        return self::$documents[$key] ??= new self(resolve(ChatPresenter::class), $context->getActor());
    }

    /**
     * Um atributo calculado do canal, da mensagem ou do fio.
     */
    public function attribute(Channel|Message|Thread $model, string $key): Closure
    {
        $this->register($model);

        return fn () => $this->data($model)[$key] ?? null;
    }

    /**
     * Os usuários que os atributos do modelo citam (a relação `users`).
     */
    public function users(Channel|Message|Thread $model): Closure
    {
        $this->register($model);

        return function () use ($model): array {
            $ids = $this->data($model)['_userIds'] ?? [];
            $this->loadUsers();

            return array_values(array_filter(array_map(fn (int $id) => $this->users[$id] ?? null, $ids)));
        };
    }

    private function register(Channel|Message|Thread $model): void
    {
        $id = (int) $model->id;

        if ($model instanceof Channel) {
            $this->channelModels[$id] ??= $model;

            if (! isset($this->channels[$id])) {
                $this->pendingChannels[$id] ??= $model;
            }
        } elseif ($model instanceof Message) {
            if (! isset($this->messages[$id])) {
                $this->pendingMessages[$id] ??= $model;
            }
        } elseif (! isset($this->threads[$id])) {
            $this->pendingThreads[$id] ??= $model;
        }
    }

    /** @return array<string, mixed> */
    private function data(Channel|Message|Thread $model): array
    {
        $id = (int) $model->id;
        $map = match (true) {
            $model instanceof Channel => 'channels',
            $model instanceof Message => 'messages',
            default => 'threads',
        };

        if (! isset($this->{$map}[$id])) {
            $this->flush();
        }

        return $this->{$map}[$id] ?? [];
    }

    /** Calcula os atributos de tudo o que foi registrado e ainda não calculado. */
    private function flush(): void
    {
        if ($threads = $this->pendingThreads) {
            $this->pendingThreads = [];
            $this->loadChannels(array_map(static fn (Thread $t) => (int) $t->channel_id, $threads));

            foreach ($threads as $thread) {
                // A ThreadPolicy lê o canal pela relação.
                if ($channel = $this->channelModels[(int) $thread->channel_id] ?? null) {
                    $thread->setRelation('channel', $channel);
                }
            }

            $this->threads += $this->presenter->threads($threads, $this->actor);
        }

        if ($messages = $this->pendingMessages) {
            $this->pendingMessages = [];

            foreach ($messages as $message) {
                if ($message->relationLoaded('channel') && ($channel = $message->getRelation('channel')) instanceof Channel) {
                    $this->channelModels[$channel->id] ??= $channel;
                }
            }

            $this->loadChannels(array_map(static fn (Message $m) => (int) $m->channel_id, $messages));
            $this->messages += $this->presenter->messages($messages, $this->channelModels, $this->actor);
        }

        if ($channels = $this->pendingChannels) {
            $this->pendingChannels = [];
            $this->channels += $this->presenter->channels($channels, $this->actor);
        }
    }

    /** @param int[] $ids */
    private function loadChannels(array $ids): void
    {
        $missing = array_values(array_diff(array_unique($ids), array_keys($this->channelModels)));

        if ($missing) {
            foreach (Channel::query()->whereIn('id', $missing)->get() as $channel) {
                $this->channelModels[$channel->id] = $channel;
            }
        }
    }

    /** Os usuários citados por tudo o que já foi calculado, numa consulta. */
    private function loadUsers(): void
    {
        $wanted = [];

        foreach ([$this->channels, $this->messages, $this->threads] as $map) {
            foreach ($map as $data) {
                foreach ($data['_userIds'] ?? [] as $id) {
                    $wanted[$id] = true;
                }
            }
        }

        $missing = array_values(array_diff(array_keys($wanted), array_keys($this->users)));

        if (! $missing) {
            return;
        }

        foreach ($missing as $id) {
            $this->users[$id] = null;
        }

        foreach (User::query()->whereIn('id', $missing)->get() as $user) {
            $this->users[(int) $user->id] = $user;
        }
    }
}
