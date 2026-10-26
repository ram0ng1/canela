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

use PHPUnit\Framework\Attributes\Test;

/**
 * O `[event]` do primeiro post vira a linha do evento (SyncPostEvent), e a
 * API mostra o cartão no post e o resumo na discussão.
 */
class CreateEventTest extends AbstractEventsTestCase
{
    /** O evento é gravado com a data convertida do fuso para UTC. */
    #[Test]
    public function primeiro_post_com_evento_cria_o_evento(): void
    {
        $json = $this->createDiscussion($this->eventCode('max="20"'));
        $discussionId = (int) $json['data']['id'];

        $event = $this->database()->table('canela_events')->where('discussion_id', $discussionId)->first();

        $this->assertNotNull($event);
        $this->assertEquals('Encontro', $event->name);
        $this->assertEquals('2030-05-10 22:00:00', $event->starts_at);
        $this->assertEquals('2030-05-11 00:00:00', $event->ends_at);
        $this->assertEquals('America/Sao_Paulo', $event->timezone);
        $this->assertEquals('Praça Central', $event->location);
        $this->assertEquals('Traga um lanche.', $event->description);
        $this->assertEquals(20, $event->max_attendees);
        $this->assertEquals(1, $event->user_id);
    }

    /** A discussão traz o resumo; o primeiro post traz o cartão inteiro. */
    #[Test]
    public function api_mostra_o_evento_na_discussao_e_no_post(): void
    {
        $json = $this->createDiscussion($this->eventCode());
        $discussionId = (int) $json['data']['id'];
        $postId = (int) $json['data']['relationships']['firstPost']['data']['id'];

        [$status, $discussion] = $this->getJson("/api/discussions/$discussionId", 2);
        $this->assertEquals(200, $status);
        $summary = $discussion['data']['attributes']['canelaEvent'];
        $this->assertEquals('Encontro', $summary['name']);
        $this->assertEquals('2030-05-10T22:00:00+00:00', $summary['startsAt']);
        $this->assertFalse($summary['ended']);

        [, $post] = $this->getJson("/api/posts/$postId", 2);
        $card = $post['data']['attributes']['canelaEvent'];
        $this->assertEquals('public', $card['status']);
        $this->assertSame(0, $card['going']);
        $this->assertNull($card['myStatus']);
        $this->assertTrue($card['canRsvp']);
        $this->assertEquals('1', $card['creator']['id']);

        // Visitante vê o cartão, mas não responde.
        [, $guest] = $this->getJson("/api/posts/$postId");
        $this->assertFalse($guest['data']['attributes']['canelaEvent']['canRsvp']);
    }

    /** Sem `[event]`, ou com uma data que não fecha, não há evento. */
    #[Test]
    public function sem_evento_valido_nada_e_gravado(): void
    {
        $plain = $this->createDiscussion('Só um tópico comum.');
        $invalid = $this->createDiscussion('[event name="X" start="amanhã"]Sem data[/event]');

        $this->assertNull($this->eventId((int) $plain['data']['id']));
        $this->assertNull($this->eventId((int) $invalid['data']['id']));
        $this->assertNull($plain['data']['attributes']['canelaEvent']);
    }

    /** Só o primeiro post tem evento: uma resposta com `[event]` é só texto. */
    #[Test]
    public function resposta_com_evento_nao_cria_evento(): void
    {
        $json = $this->createDiscussion('Tópico sem evento.');
        $discussionId = (int) $json['data']['id'];

        $response = $this->send($this->request('POST', '/api/posts', [
            'authenticatedAs' => 2,
            'json' => [
                'data' => [
                    'type' => 'posts',
                    'attributes' => ['content' => $this->eventCode()],
                    'relationships' => ['discussion' => ['data' => ['type' => 'discussions', 'id' => (string) $discussionId]]],
                ],
            ],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(0, $this->database()->table('canela_events')->count());
    }

    /** Editar o primeiro post atualiza o evento; tirar o `[event]` apaga o evento. */
    #[Test]
    public function editar_o_primeiro_post_atualiza_e_apaga_o_evento(): void
    {
        $json = $this->createDiscussion($this->eventCode());
        $discussionId = (int) $json['data']['id'];
        $postId = (int) $json['data']['relationships']['firstPost']['data']['id'];

        $edit = fn (string $content) => $this->send($this->request('PATCH', "/api/posts/$postId", [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'posts', 'id' => (string) $postId, 'attributes' => ['content' => $content]]],
        ]));

        $response = $edit('[event name="Encontro adiado" start="2030-06-01 10:00"]Nova data.[/event]');
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $event = $this->database()->table('canela_events')->where('discussion_id', $discussionId)->first();
        $this->assertEquals('Encontro adiado', $event->name);
        $this->assertEquals('2030-06-01 10:00:00', $event->starts_at);
        $this->assertNull($event->ends_at);

        $edit('Cancelado, sem evento.');
        $this->assertNull($this->eventId($discussionId));
    }

    /** Com `canela.events_enabled` desligado, nada é gravado e as rotas respondem 404. */
    #[Test]
    public function eventos_desligados(): void
    {
        $this->setting('canela.events_enabled', '0');

        $json = $this->createDiscussion($this->eventCode());

        $this->assertNull($this->eventId((int) $json['data']['id']));
        $this->assertArrayNotHasKey('canelaEvent', $json['data']['attributes']);

        [$upcoming] = $this->getJson('/api/canela-events', 2);
        [$invitees] = $this->getJson('/api/canela-events/1/invitees', 2);

        $this->assertEquals(404, $upcoming);
        $this->assertEquals(404, $invitees);
    }
}
