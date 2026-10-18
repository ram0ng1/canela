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

namespace Ramon\Canela\RamonChat\Http;

use Carbon\Carbon;
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\Notification;
use Flarum\User\User;
use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Ramon\Canela\RamonChat\AutoJoin;
use Ramon\Canela\RamonChat\Notification\ChatMentionBlueprint;
use Ramon\Canela\RamonChat\Notification\ChatMessageBlueprint;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Canela\RamonChat\TypingStore;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Message;

/**
 * O que o tema faz em volta de rotas do próprio ramon/chat, sem tocar nele:
 *
 * - `POST /api/chat/direct` (antes): o limite de participantes do admin e a
 *   recusa de MD com quem não pode usar o chat ou o desligou;
 * - `POST /api/chat-channels/{id}/read` e `chat-threads/{id}/read` (depois):
 *   os avisos do sino daquele canal ou fio ficam lidos;
 * - `GET /api/chat-channels` (antes): o auto-join preguiçoso;
 * - `POST /api/chat/typing` (depois): o "está digitando" vai para o cache,
 *   para quem não tem websocket.
 *
 * Roda em todo pedido da API: fora dessas rotas é uma comparação de texto.
 * O construtor só guarda o container; o resto é resolvido no uso.
 */
final class RamonChatMiddleware implements MiddlewareInterface
{
    private const ROUTES = [
        'chat.direct.start' => true,
        'chat-channels.read' => true,
        'chat-threads.read' => true,
        'chat-channels.index' => true,
        'chat.typing' => true,
    ];

    public function __construct(
        private readonly Container $container,
    ) {
    }

    #[\Override]
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $route = $request->getAttribute('routeName');

        if (! is_string($route) || ! isset(self::ROUTES[$route])) {
            return $handler->handle($request);
        }

        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest()) {
            return $handler->handle($request);
        }

        $settings = $this->container->make(RamonChatSettings::class);

        if ($route === 'chat.direct.start' && $settings->enabled('dm_guard')) {
            // Lança ValidationException (422), tratada pelo HandleErrors da API.
            $this->guardDirect($request, $actor, $settings);
        }

        if ($route === 'chat-channels.index' && $settings->enabled('auto_join') && $request->getMethod() === 'GET') {
            $this->container->make(AutoJoin::class)->run($actor);
        }

        $response = $handler->handle($request);

        // Só depois de o ramon/chat aceitar: um erro dele já subiu como exceção.
        if ($response->getStatusCode() >= 300) {
            return $response;
        }

        try {
            if (($route === 'chat-channels.read' || $route === 'chat-threads.read') && $settings->enabled('bell')) {
                $this->markRead($actor, $route === 'chat-threads.read' ? 'thread_id' : 'channel_id', (int) Arr::get($request->getAttribute('routeParameters', []), 'id'));
            }

            if ($route === 'chat.typing' && $settings->enabled('typing_poll')) {
                $this->recordTyping($request, $actor);
            }
        } catch (\Throwable $error) {
            // O pedido do ramon/chat já deu certo: o extra do tema não o estraga.
            $this->container->make(LoggerInterface::class)->warning('[ramon/canela] ramon-chat: '.$route.': '.$error->getMessage());
        }

        return $response;
    }

    /**
     * O limite do admin (abaixo do teto de 20 do ramon/chat) e a recusa de
     * quem não pode receber: sem a permissão `ramon-chat.use` ou com o chat
     * desligado nas Configurações — a conversa abriria e ninguém responderia.
     *
     * @throws ValidationException
     */
    private function guardDirect(ServerRequestInterface $request, User $actor, RamonChatSettings $settings): void
    {
        $requested = (array) Arr::get((array) $request->getParsedBody(), 'data.attributes.userIds', []);

        $ids = array_values(array_unique(array_filter(
            array_map('intval', $requested),
            static fn (int $id): bool => $id > 0 && $id !== (int) $actor->id
        )));

        if ($ids === []) {
            return;
        }

        $translator = $this->container->make(TranslatorInterface::class);
        $max = $settings->dmMax();

        if (count($ids) + 1 > $max) {
            throw new ValidationException([
                'userIds' => $translator->trans('ramon-canela.forum.chat.errors.too_many_users', ['count' => $max]),
            ]);
        }

        foreach (User::query()->whereKey($ids)->get() as $user) {
            /** @var User $user */
            if ($user->getPreference('ramon-chat.enabled') === false || ! $user->hasPermission('ramon-chat.use')) {
                throw new ValidationException([
                    'userIds' => $translator->trans('ramon-canela.forum.chat.errors.user_cannot_chat', ['username' => $user->display_name]),
                ]);
            }
        }
    }

    /** Os avisos do sino das mensagens daquele canal (ou fio), não lidos, ficam lidos. */
    private function markRead(User $actor, string $column, int $id): void
    {
        if ($id <= 0) {
            return;
        }

        Notification::query()
            ->where('user_id', $actor->id)
            ->whereIn('type', [ChatMentionBlueprint::TYPE, ChatMessageBlueprint::TYPE])
            ->whereNull('read_at')
            ->whereIn('subject_id', Message::query()->select('id')->where($column, $id))
            ->update(['read_at' => Carbon::now()]);
    }

    /**
     * O sinal que o ramon/chat só manda pelo websocket, no cache. Só de quem
     * está no canal e não entrou escondido (um moderador lendo sem aparecer
     * continua sem aparecer): a regra do TypingController dele.
     */
    private function recordTyping(ServerRequestInterface $request, User $actor): void
    {
        $body = (array) $request->getParsedBody();
        $channelId = (int) Arr::get($body, 'data.attributes.channelId');
        $typing = (bool) Arr::get($body, 'data.attributes.typing', true);

        if ($channelId <= 0) {
            return;
        }

        $visible = ChannelUser::query()
            ->where('channel_id', $channelId)
            ->where('user_id', $actor->id)
            ->whereNull('left_at')
            ->where('hidden', false)
            ->exists();

        if (! $visible) {
            return;
        }

        $this->container->make(TypingStore::class)->touch($channelId, (int) $actor->id, (string) $actor->display_name, $typing);
    }
}
