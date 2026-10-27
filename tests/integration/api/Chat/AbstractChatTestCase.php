<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Chat;

use Flarum\Group\PermissionCache;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;

/**
 * Base dos testes do chat: o tema ligado, o chat ligado no admin e um
 * elenco fixo de pessoas.
 *
 * - 1: administrador;
 * - 2: membro comum (o `normalUser()`);
 * - 3: moderador (grupo 4, que tem `canela.chat.moderate` por padrão);
 * - 4: outro membro comum.
 *
 * O canal 1 é público e avulso (sem tag), com o 2 e o 3 como participantes.
 * As respostas são documentos JSON:API (`chat-channels`, `chat-messages`,
 * `chat-threads`, com os usuários no `included`); `data()` os devolve no
 * formato que o fórum usa, com o id e os atributos lado a lado.
 *
 * As permissões do chat (`canela.chat.*`) começam como a migration as semeia
 * num fórum novo: usar e mandar MD para os membros (3), moderar para os
 * moderadores (4), criar canal só para os administradores.
 */
abstract class AbstractChatTestCase extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** Extensões ligadas além do tema. */
    protected array $extraExtensions = [];

    public function setUp(): void
    {
        parent::setUp();

        $this->extension(...[...$this->extraExtensions, 'ramon-canela']);

        $this->setting('canela.chat_enabled', '1');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'moderador', 'email' => 'moderador@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => true],
                ['id' => 4, 'username' => 'outro', 'email' => 'outro@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => true],
            ],
            'group_user' => [
                ['user_id' => 3, 'group_id' => 4],
            ],
            'canela_chat_channels' => [
                ['id' => 1, 'type' => 'public', 'name' => 'Geral', 'slug' => 'geral', 'status' => 0, 'threading_enabled' => true, 'user_count' => 2, 'created_by_id' => 1, 'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00'],
            ],
            'canela_chat_memberships' => [
                ['channel_id' => 1, 'user_id' => 2, 'following' => true, 'notification_level' => 1],
                ['channel_id' => 1, 'user_id' => 3, 'following' => true, 'notification_level' => 1],
            ],
        ]);
    }

    /**
     * Uma chamada à API; devolve o status e o corpo decodificado.
     *
     * @param array<string, mixed>|null $json
     * @param array<string, mixed> $query
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function api(string $method, string $path, ?int $actor, ?array $json = null, array $query = []): array
    {
        $options = $actor ? ['authenticatedAs' => $actor] : [];

        if ($method !== 'GET') {
            $options['json'] = $json ?? [];
        }

        $request = $this->request($method, '/api'.$path, $options);

        if ($query) {
            $request = $request->withQueryParams($query);
        }

        $response = $this->send($request);
        $body = (string) $response->getBody();

        return [$response->getStatusCode(), $body === '' ? null : json_decode($body, true)];
    }

    /**
     * O corpo JSON:API de uma gravação (POST ou PATCH de um recurso).
     *
     * @param array<string, mixed> $attributes
     * @param array<string, mixed> $relationships
     * @return array<string, mixed>
     */
    protected static function document(string $type, array $attributes = [], array $relationships = []): array
    {
        $data = ['type' => $type, 'attributes' => $attributes];

        if ($relationships) {
            $data['relationships'] = $relationships;
        }

        return ['data' => $data];
    }

    /** @return array<string, mixed> */
    protected static function channelLink(int $channelId): array
    {
        return ['channel' => ['data' => ['type' => 'chat-channels', 'id' => (string) $channelId]]];
    }

    /**
     * Um recurso como o fórum o usa: o id (número) e os atributos; o
     * `channelType` volta a ser o `type` do canal.
     *
     * @param array<string, mixed> $resource
     * @return array<string, mixed>
     */
    protected static function item(array $resource): array
    {
        $item = ['id' => (int) $resource['id'], ...($resource['attributes'] ?? [])];

        if (array_key_exists('channelType', $item)) {
            $item['type'] = $item['channelType'];
        }

        return $item;
    }

    /**
     * O `data` da resposta, já como itens.
     *
     * @param array<string, mixed>|null $body
     * @return array<int|string, mixed>
     */
    protected static function data(?array $body): array
    {
        $data = $body['data'] ?? [];

        return array_is_list($data) ? array_map(self::item(...), $data) : self::item($data);
    }

    /**
     * Os ids de um tipo no `included`.
     *
     * @param array<string, mixed>|null $body
     * @return string[]
     */
    protected static function includedIds(?array $body, string $type): array
    {
        return array_values(array_map(
            static fn (array $item) => (string) $item['id'],
            array_filter($body['included'] ?? [], static fn (array $item) => $item['type'] === $type)
        ));
    }

    /**
     * Troca os grupos que têm uma permissão do chat (o que antes era a lista
     * de grupos nas configurações).
     *
     * @param int[] $groupIds
     */
    protected function grant(string $permission, array $groupIds): void
    {
        $this->database()->table('group_permission')->where('permission', $permission)->delete();

        foreach ($groupIds as $groupId) {
            $this->database()->table('group_permission')->insert(['permission' => $permission, 'group_id' => $groupId]);
        }

        // O core guarda as permissões de cada conjunto de grupos no processo,
        // e a gravação direta no banco não o avisa (o admin avisa).
        $this->app()->getContainer()->make(PermissionCache::class)->flush();
    }

    /**
     * Envia uma mensagem e devolve o corpo da resposta.
     *
     * @param array<string, mixed> $extra
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function sendMessage(int $channelId, int $actor, string $text, array $extra = []): array
    {
        return $this->api('POST', '/chat-messages', $actor, self::document('chat-messages', ['message' => $text, ...$extra], self::channelLink($channelId)));
    }

    /** Envia uma mensagem e devolve o id dela. */
    protected function post(int $channelId, int $actor, string $text, array $extra = []): int
    {
        [$status, $body] = $this->sendMessage($channelId, $actor, $text, $extra);

        $this->assertEquals(201, $status, json_encode($body));

        return (int) $body['data']['id'];
    }

    /**
     * As mensagens de um canal (ou de um fio), pelo cursor.
     *
     * @param array<string, mixed> $filter
     * @param array<string, mixed> $page
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function messages(int $channelId, int $actor, array $filter = [], array $page = []): array
    {
        return $this->api('GET', '/chat-messages', $actor, null, array_filter(['filter' => ['channel' => $channelId, ...$filter], 'page' => $page]));
    }

    /** O canal como o ator o vê (com `membership.unreadCount`). */
    protected function channelFor(int $channelId, int $actor): array
    {
        [$status, $body] = $this->api('GET', "/chat-channels/$channelId", $actor);

        $this->assertEquals(200, $status, json_encode($body));

        return self::data($body);
    }
}
