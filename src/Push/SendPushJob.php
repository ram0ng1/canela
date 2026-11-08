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

use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\Http\UrlGenerator;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\Queue\AbstractJob;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Manda a notificação para os aparelhos das pessoas. O texto é curto (quem,
 * o quê e o tópico) e o clique abre o tópico ou o post. Aparelho que o
 * serviço de push diz que não existe mais (404/410) é apagado.
 */
final class SendPushJob extends AbstractJob
{
    /** @param int[] $userIds */
    public function __construct(
        private readonly BlueprintInterface $blueprint,
        private readonly array $userIds,
    ) {
        parent::__construct();
    }

    public function handle(Push $push, UrlGenerator $url, TranslatorInterface $translator, SettingsRepositoryInterface $settings, SlugManager $slugs): void
    {
        $keys = $push->keys();
        $webPush = new WebPush(['VAPID' => [
            'subject' => $url->to('forum')->base(),
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey'],
        ]]);

        $subject = $this->blueprint->getSubject();
        $from = $this->blueprint->getFromUser();
        $discussion = $subject instanceof Post ? $subject->discussion : ($subject instanceof Discussion ? $subject : null);

        $link = match (true) {
            $subject instanceof Post && $discussion !== null => $url->to('forum')->route('discussion', ['id' => $discussion->id, 'near' => $subject->number]),
            $discussion !== null => $url->to('forum')->route('discussion', ['id' => $discussion->id]),
            $subject instanceof User => $url->to('forum')->route('user', ['username' => $slugs->forResource(User::class)->toSlug($subject)]),
            default => $url->to('forum')->base(),
        };

        $type = $this->blueprint::getType();
        $key = 'ramon-canela.forum.push.types.'.$type;

        $subscriptions = PushSubscription::query()->whereIn('user_id', $this->userIds)->get();
        $users = User::query()->whereIn('id', $this->userIds)->get()->keyBy('id');

        foreach ($subscriptions as $subscription) {
            $user = $users->get($subscription->user_id);
            // No idioma da pessoa, sem trocar o do tradutor (com a fila síncrona
            // o job roda dentro da própria requisição).
            $locale = (string) ($user?->getPreference('locale') ?: $settings->get('default_locale'));
            $params = ['username' => $from?->display_name];
            $what = $translator->trans($key, $params, null, $locale);
            $what = $what === $key ? $translator->trans('ramon-canela.forum.push.generic', $params, null, $locale) : $what;

            $webPush->queueNotification(
                Subscription::create(['endpoint' => $subscription->endpoint, 'publicKey' => $subscription->public_key, 'authToken' => $subscription->auth_token, 'contentEncoding' => 'aes128gcm']),
                (string) json_encode([
                    'title' => $discussion?->title ?: (string) $settings->get('forum_title'),
                    'body' => $what,
                    'url' => $link,
                    'tag' => $type.'-'.($discussion->id ?? $subject->getKey()),
                    'icon' => $from?->avatar_url,
                ]),
            );
        }

        foreach ($webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                PushSubscription::query()->where('endpoint_hash', hash('sha256', $report->getEndpoint()))->delete();
            }
        }
    }
}
