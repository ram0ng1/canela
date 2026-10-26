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

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;

/**
 * Base dos testes do chat: o tema ligado, o chat ligado no admin e um
 * elenco fixo de pessoas.
 *
 * - 1: administrador;
 * - 2: membro comum (o `normalUser()`);
 * - 3: moderador (grupo 4, o padrão de `canela.chat_moderator_groups`);
 * - 4: outro membro comum.
 *
 * O canal 1 é público e avulso (sem tag), com o 2 e o 3 como participantes.
 * As respostas do chat são JSON próprio (não JSON:API): `channel`,
 * `message`, `users`…
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
     * Uma chamada à API do chat; devolve o status e o corpo decodificado.
     *
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function chat(string $method, string $path, ?int $actor, array $json = [], array $query = []): array
    {
        $options = $actor ? ['authenticatedAs' => $actor] : [];

        if ($method !== 'GET') {
            $options['json'] = $json;
        }

        $request = $this->request($method, '/api/chat'.$path, $options);

        if ($query) {
            $request = $request->withQueryParams($query);
        }

        $response = $this->send($request);
        $body = (string) $response->getBody();

        return [$response->getStatusCode(), $body === '' ? null : json_decode($body, true)];
    }

    /** Envia uma mensagem e devolve o id dela. */
    protected function post(int $channelId, int $actor, string $text, array $extra = []): int
    {
        [$status, $body] = $this->chat('POST', "/channels/$channelId/messages", $actor, ['message' => $text, ...$extra]);

        $this->assertEquals(200, $status, json_encode($body));

        return (int) $body['message']['id'];
    }

    /** O canal como o ator o vê (com `membership.unreadCount`). */
    protected function channelFor(int $channelId, int $actor): array
    {
        [$status, $body] = $this->chat('GET', "/channels/$channelId", $actor);

        $this->assertEquals(200, $status, json_encode($body));

        return $body['channel'];
    }
}
