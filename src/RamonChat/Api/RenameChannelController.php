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

namespace Ramon\Canela\RamonChat\Api;

use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\NotAuthenticatedException;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Event\ChannelWasEdited;

/**
 * `POST /api/canela-ramon-chat/channels/{id}/name`: o nome do chat em grupo,
 * que qualquer participante muda. O ramon/chat só deixa o
 * moderador do chat editar uma MD (a política `edit` dele); aqui basta ser
 * participante ativo — e só o nome muda, nada mais do canal.
 *
 * Nome vazio volta ao rótulo pelos participantes.
 */
final class RenameChannelController implements RequestHandlerInterface
{
    private const MAX_LENGTH = 50;

    public function __construct(
        private readonly Dispatcher $events,
        private readonly TranslatorInterface $translator,
        private readonly RamonChatSettings $settings,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest()) {
            throw new NotAuthenticatedException();
        }

        $id = (int) Arr::get($request->getQueryParams(), 'id');
        /** @var Channel|null $channel */
        $channel = Channel::query()->whereKey($id)->whereNull('deleted_at')->first();

        $member = $channel !== null && ChannelUser::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', $actor->id)
            ->whereNull('left_at')
            ->where('hidden', false)
            ->exists();

        if (! $this->settings->enabled('group_name') || $channel === null || ! $channel->isDirect() || ! $member || $channel->isArchived()) {
            throw new PermissionDeniedException();
        }

        $name = (string) Arr::get((array) $request->getParsedBody(), 'data.attributes.name', '');
        // Sem quebras nem caracteres de controle: o nome é uma linha só.
        $name = trim((string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $name));

        if (mb_strlen($name) > self::MAX_LENGTH) {
            throw new ValidationException([
                'name' => $this->translator->trans('ramon-canela.forum.chat.errors.name_too_long', ['count' => self::MAX_LENGTH]),
            ]);
        }

        $channel->name = $name === '' ? null : $name;

        if ($channel->isDirty('name')) {
            $channel->save();
            $this->events->dispatch(new ChannelWasEdited($channel, $actor));
        }

        return new JsonResponse(ChannelDocument::make($request, (int) $channel->id, false));
    }
}
