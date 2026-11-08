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

namespace Ramon\Canela\Push;

use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\Driver\NotificationDriverInterface;
use Flarum\User\User;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Queue\Queue;

/**
 * O canal "Push" das notificações, ao lado de "Alerta" e "E-mail" (a coluna
 * nova em Configurações → Notificações). Ligado por padrão em todos os tipos:
 * só chega a quem ligou o push em algum aparelho.
 */
final class PushNotificationDriver implements NotificationDriverInterface
{
    public function __construct(
        private readonly Container $container,
        private readonly Push $push,
    ) {
    }

    #[\Override]
    public function send(BlueprintInterface $blueprint, array $users): void
    {
        if (! $this->push->enabled()) {
            return;
        }

        $ids = array_values(array_map(
            static fn (User $user) => $user->id,
            array_filter($users, static fn (User $user) => (bool) $user->getPreference(User::getNotificationPreferenceKey($blueprint::getType(), 'push'))),
        ));

        if ($ids && PushSubscription::query()->whereIn('user_id', $ids)->exists()) {
            // A fila resolvida na hora de enfileirar, como o driver de e-mail do core.
            /** @var Queue $queue */
            $queue = $this->container->make(Queue::class);
            $queue->push(new SendPushJob($blueprint, $ids));
        }
    }

    #[\Override]
    public function registerType(string $blueprintClass, array $driversEnabledByDefault): void
    {
        User::registerPreference(User::getNotificationPreferenceKey($blueprintClass::getType(), 'push'), boolval(...), true);
    }
}
