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

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\RamonChat\Access\RenameChannelPolicy;
use Ramon\Canela\RamonChat\Validation\ChannelNameValidator;
use Ramon\Chat\Channel;
use Ramon\Chat\Event\ChannelWasEdited;

/**
 * `POST /api/chat-channels/{id}/canela-name` `{data: {attributes: {name}}}`:
 * o nome do chat em grupo, que qualquer participante muda — um endpoint de
 * ação no recurso de canais do ramon/chat.
 *
 * O canal passa pela busca e pela visibilidade do recurso dele (o que não se
 * vê, 404); quem pode renomear é a RenameChannelPolicy (403); o nome passa
 * pelo ChannelNameValidator (422). Só o nome muda, nada mais do canal. Nome
 * vazio volta ao rótulo pelos participantes.
 *
 * A resposta é o documento do canal como o ramon/chat o serve
 * (ChannelDocument), que o JS dele já sabe ler.
 */
final class RenameChannel
{
    public function __construct(
        private readonly Dispatcher $events,
        private readonly ChannelNameValidator $validator,
    ) {
    }

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.rename')
            ->route('POST', '/{id}/canela-name')
            ->authenticated()
            ->can(RenameChannelPolicy::ABILITY)
            ->action(static fn (Context $context): Channel => resolve(self::class)->rename($context))
            ->response(static fn (Context $context, Channel $channel): JsonResponse => new JsonResponse(ChannelDocument::make($context->request, (int) $channel->id, false)));
    }

    public function rename(Context $context): Channel
    {
        /** @var Channel $channel */
        $channel = $context->model;

        $name = Arr::get((array) $context->request->getParsedBody(), 'data.attributes.name', '');
        // Sem quebras nem caracteres de controle: o nome é uma linha só.
        $name = is_string($name) ? trim((string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $name)) : $name;

        $this->validator->assertValid(['name' => $name]);

        $channel->name = $name === '' || $name === null ? null : (string) $name;

        if ($channel->isDirty('name')) {
            $channel->save();
            $this->events->dispatch(new ChannelWasEdited($channel, $context->getActor()));
        }

        return $channel;
    }
}
