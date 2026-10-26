<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Events;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;

/**
 * Base dos testes de eventos: o tema ligado e três pessoas — o
 * administrador (1), o membro comum (2) e outro membro (3). O evento nasce
 * do `[event]` no primeiro post de uma discussão criada pela API.
 */
abstract class AbstractEventsTestCase extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** Extensões ligadas além do tema. */
    protected array $extraExtensions = [];

    public function setUp(): void
    {
        parent::setUp();

        $this->extension(...[...$this->extraExtensions, 'ramon-canela']);

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outro', 'email' => 'outro@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => true],
            ],
        ]);
    }

    /**
     * Cria a discussão com esse conteúdo e devolve o JSON:API da resposta.
     *
     * @return array<string, mixed>
     */
    protected function createDiscussion(string $content, int $actor = 1, array $relationships = []): array
    {
        $response = $this->send($this->request('POST', '/api/discussions', [
            'authenticatedAs' => $actor,
            'json' => [
                'data' => [
                    'type' => 'discussions',
                    'attributes' => ['title' => 'Encontro da comunidade', 'content' => $content],
                    'relationships' => $relationships,
                ],
            ],
        ]));

        $body = (string) $response->getBody();
        $this->assertEquals(201, $response->getStatusCode(), $body);

        return json_decode($body, true);
    }

    /** O `[event]` padrão dos testes, com atributos extras. */
    protected function eventCode(string $attributes = ''): string
    {
        return '[event name="Encontro" start="2030-05-10 19:00" end="2030-05-10 21:00" timezone="America/Sao_Paulo" location="Praça Central" '.$attributes.']Traga um lanche.[/event]';
    }

    /** O id do evento da discussão, ou null. */
    protected function eventId(int $discussionId): ?int
    {
        $id = $this->database()->table('canela_events')->where('discussion_id', $discussionId)->value('id');

        return $id === null ? null : (int) $id;
    }

    /**
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function rsvp(int $eventId, int $actor, mixed $status): array
    {
        $response = $this->send($this->request('POST', "/api/canela-events/$eventId/rsvp", [
            'authenticatedAs' => $actor,
            'json' => ['status' => $status],
        ]));

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }

    /**
     * @return array{0: int, 1: array<string, mixed>|null}
     */
    protected function getJson(string $path, ?int $actor = null, array $query = []): array
    {
        $request = $this->request('GET', $path, $actor ? ['authenticatedAs' => $actor] : []);

        if ($query) {
            $request = $request->withQueryParams($query);
        }

        $response = $this->send($request);

        return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
    }
}
