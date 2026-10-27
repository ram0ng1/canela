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
            'json' => ['data' => ['type' => 'canela-events', 'id' => (string) $eventId, 'attributes' => ['status' => $status]]],
        ]));

        $body = json_decode((string) $response->getBody(), true);

        // O cartão do evento: os atributos do recurso, com o id.
        if (isset($body['data']['attributes'])) {
            $body['event'] = ['id' => (int) $body['data']['id']] + $body['data']['attributes'];
        }

        return [$response->getStatusCode(), $body];
    }

    /**
     * A agenda (GET /api/canela-events) como o fórum a lê: uma linha por
     * ocorrência, em ordem, com o nome (ou o título da discussão) e a discussão.
     *
     * @param array<string, string> $filter
     * @return array{0: int, 1: array{events: list<array<string, mixed>>}|null}
     */
    protected function agenda(?int $actor, array $filter = [], array $query = []): array
    {
        [$status, $body] = $this->getJson('/api/canela-events', $actor, [...$query, ...($filter ? ['filter' => $filter] : [])]);

        if ($status !== 200) {
            return [$status, null];
        }

        $discussions = [];

        foreach ($body['included'] ?? [] as $included) {
            if ($included['type'] === 'discussions') {
                $discussions[$included['id']] = $included['attributes'];
            }
        }

        $events = [];

        foreach ($body['data'] as $event) {
            $discussionId = $event['relationships']['discussion']['data']['id'] ?? null;
            $discussion = $discussions[$discussionId] ?? [];

            foreach ($event['attributes']['occurrences'] as $occurrence) {
                $events[] = [
                    'id' => (int) $event['id'],
                    'name' => $event['attributes']['name'] ?: ($discussion['title'] ?? null),
                    'startsAt' => $occurrence['startsAt'],
                    'endsAt' => $occurrence['endsAt'],
                    'going' => $event['attributes']['going'],
                    'discussion' => ['id' => $discussionId, 'title' => $discussion['title'] ?? null, 'slug' => $discussion['slug'] ?? null],
                ];
            }
        }

        usort($events, static fn (array $a, array $b): int => strcmp($a['startsAt'], $b['startsAt']));

        return [$status, ['events' => $events]];
    }

    /**
     * Os convidados de um status: as pessoas (os atributos de cada `users`,
     * com o id), o status e as contagens.
     *
     * @return array{0: int, 1: array{status: string, users: list<array<string, mixed>>, counts: array<string, int>}|null}
     */
    protected function invitees(int $eventId, ?int $actor = null, array $query = []): array
    {
        [$status, $body] = $this->getJson("/api/canela-events/$eventId/invitees", $actor, $query);

        if ($status !== 200) {
            return [$status, null];
        }

        return [$status, [
            'status' => $body['meta']['status'],
            'counts' => $body['meta']['counts'],
            'users' => array_map(static fn (array $user) => ['id' => $user['id']] + $user['attributes'], $body['data']),
            'types' => array_unique(array_column($body['data'], 'type')),
        ]];
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
