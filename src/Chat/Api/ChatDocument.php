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
use Flarum\Api\Serializer;
use Psr\Http\Message\ResponseInterface;

use function Tobyz\JsonApiServer\json_api_response;

/**
 * Monta a resposta JSON:API dos endpoints de ação do chat, com os mesmos
 * recursos (e o mesmo lote de atributos) que os endpoints padrão usam: um
 * canal, uma lista de mensagens, os usuários da busca…
 *
 * `$extraUsers` entra no `included` sem estar ligado a um recurso da lista:
 * é quem está digitando, que o "fulano está digitando" precisa no store.
 */
final class ChatDocument
{
    /**
     * @param array<string, mixed> $include no formato do serializador: ['users' => []]
     * @param array<string, mixed> $meta
     */
    public static function single(Context $context, string $type, object $model, array $include = ['users' => []], array $meta = [], int $status = 200): ResponseInterface
    {
        $document = self::build($context, $type, [$model], $include, $meta, []);
        $document['data'] = $document['data'][0] ?? null;

        return json_api_response($document, $status);
    }

    /**
     * @param iterable<object> $models
     * @param array<string, mixed> $include
     * @param array<string, mixed> $meta
     * @param iterable<object> $extraUsers
     */
    public static function collection(Context $context, string $type, iterable $models, array $include = ['users' => []], array $meta = [], iterable $extraUsers = []): ResponseInterface
    {
        return json_api_response(self::build($context, $type, $models, $include, $meta, $extraUsers));
    }

    /**
     * @param iterable<object> $models
     * @param array<string, mixed> $include
     * @param array<string, mixed> $meta
     * @param iterable<object> $extraUsers
     * @return array<string, mixed>
     */
    private static function build(Context $context, string $type, iterable $models, array $include, array $meta, iterable $extraUsers): array
    {
        $serializer = new Serializer($context);
        $resource = $context->resource($type);

        foreach ($models as $model) {
            $serializer->addPrimary($resource, $model, $include);
        }

        [$data, $included] = $serializer->serialize();

        $seen = [];

        foreach ([...$data, ...$included] as $item) {
            $seen[$item['type'].':'.$item['id']] = true;
        }

        $extra = new Serializer($context);
        $users = $context->resource('users');
        $any = false;

        foreach ($extraUsers as $user) {
            $extra->addPrimary($users, $user, []);
            $any = true;
        }

        if ($any) {
            foreach (array_merge(...$extra->serialize()) as $item) {
                if (! isset($seen[$item['type'].':'.$item['id']])) {
                    $included[] = $item;
                    $seen[$item['type'].':'.$item['id']] = true;
                }
            }
        }

        $document = ['data' => $data];

        if ($included) {
            $document['included'] = $included;
        }

        if ($meta) {
            $document['meta'] = $meta;
        }

        return $document;
    }
}
