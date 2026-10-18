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

use Flarum\Api\Client;
use Psr\Http\Message\ServerRequestInterface;

/**
 * O canal como o ChannelResource do ramon/chat o serve (`GET /chat-channels/{id}`),
 * para os endpoints do tema devolverem o mesmo documento que o JS dele já
 * sabe ler — o truque do StartDirectController dele. Se a leitura falhar, vai
 * só o id: o canal já existe, e o JS o busca sozinho.
 */
final class ChannelDocument
{
    /** @return array<string, mixed> */
    public static function make(ServerRequestInterface $request, int $channelId, bool $created): array
    {
        try {
            $document = json_decode(
                (string) resolve(Client::class)
                    ->withoutErrorHandling()
                    ->withParentRequest($request)
                    ->get('/chat-channels/'.$channelId)
                    ->getBody(),
                true
            );

            if (is_array($document) && isset($document['data']['id'])) {
                $document['meta'] = ['created' => $created, 'serialized' => true];

                return $document;
            }
        } catch (\Throwable) {
            // Cai no documento mínimo abaixo.
        }

        return [
            'data' => ['type' => 'chat-channels', 'id' => (string) $channelId],
            'meta' => ['created' => $created, 'serialized' => false],
        ];
    }
}
