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
 * O evento só existe para quem vê a discussão: para os outros, 404, e ele
 * some da agenda (GET /api/canela-events).
 */
class VisibilityTest extends AbstractEventsTestCase
{
    /** A agenda lista as ocorrências no intervalo, com a discussão. */
    #[Test]
    public function agenda_lista_os_proximos_eventos(): void
    {
        $json = $this->createDiscussion($this->eventCode());
        $discussionId = $json['data']['id'];

        [$status, $body] = $this->agenda(2, ['from' => '2030-05-01', 'to' => '2030-05-31']);

        $this->assertEquals(200, $status);
        $this->assertCount(1, $body['events']);
        $this->assertEquals('Encontro', $body['events'][0]['name']);
        $this->assertEquals('2030-05-10T22:00:00+00:00', $body['events'][0]['startsAt']);
        $this->assertEquals($discussionId, $body['events'][0]['discussion']['id']);

        [, $outside] = $this->agenda(2, ['from' => '2030-06-01', 'to' => '2030-06-30']);
        $this->assertSame([], $outside['events']);
    }

    /** Evento recorrente aparece uma vez por ocorrência. */
    #[Test]
    public function evento_recorrente_aparece_por_ocorrencia(): void
    {
        $this->createDiscussion('[event name="Semanal" start="2030-05-01 10:00" recurrence="every_week" until="2030-05-31"]Toda semana[/event]');

        [, $body] = $this->agenda(2, ['from' => '2030-05-01', 'to' => '2030-06-30']);

        $this->assertEquals(
            ['2030-05-01', '2030-05-08', '2030-05-15', '2030-05-22', '2030-05-29'],
            array_map(static fn ($e) => substr($e['startsAt'], 0, 10), $body['events'])
        );
    }

    /**
     * Discussão oculta: quem não a vê recebe 404 nos convidados e na
     * presença, e o evento sai da agenda dele; o administrador ainda vê.
     */
    #[Test]
    public function discussao_invisivel_esconde_o_evento(): void
    {
        $json = $this->createDiscussion($this->eventCode());
        $discussionId = (int) $json['data']['id'];
        $id = $this->eventId($discussionId);

        $this->database()->table('discussions')->where('id', $discussionId)->update(['hidden_at' => '2026-01-01 00:00:00', 'hidden_user_id' => 1]);

        [$invitees] = $this->invitees($id, 2);
        [$rsvp] = $this->rsvp($id, 2, 'going');
        [, $agenda] = $this->agenda(2, ['from' => '2030-05-01', 'to' => '2030-05-31']);
        [$admin] = $this->invitees($id, 1);

        $this->assertEquals(404, $invitees);
        $this->assertEquals(404, $rsvp);
        $this->assertSame([], $agenda['events']);
        $this->assertEquals(200, $admin);
    }

    /** Primeiro post oculto: o evento sai da agenda. */
    #[Test]
    public function primeiro_post_oculto_sai_da_agenda(): void
    {
        $this->createDiscussion($this->eventCode());

        $this->database()->table('posts')->where('number', 1)->update(['hidden_at' => '2026-01-01 00:00:00', 'hidden_user_id' => 1]);

        [, $agenda] = $this->agenda(1, ['from' => '2030-05-01', 'to' => '2030-05-31']);

        $this->assertSame([], $agenda['events']);
    }
    /**
     * `page[limit]` conta ocorrências, e não eventos; a agenda não traz o
     * cartão inteiro (sem a resposta de quem pede nem a amostra de quem vai).
     */
    #[Test]
    public function limite_conta_ocorrencias(): void
    {
        $this->createDiscussion('[event name="Semanal" start="2030-05-01 10:00" recurrence="every_week" until="2030-05-31"]Toda semana[/event]');

        [, $body] = $this->agenda(2, ['from' => '2030-05-01', 'to' => '2030-06-30'], ['page' => ['limit' => 2]]);

        $this->assertEquals(['2030-05-01', '2030-05-08'], array_map(static fn ($e) => substr($e['startsAt'], 0, 10), $body['events']));

        [, $raw] = $this->getJson('/api/canela-events', 2, ['filter' => ['from' => '2030-05-01', 'to' => '2030-06-30']]);

        $this->assertCount(1, $raw['data']);
        $this->assertArrayNotHasKey('sample', $raw['data'][0]['attributes']);
        $this->assertArrayNotHasKey('myStatus', $raw['data'][0]['attributes']);
        $this->assertArrayNotHasKey('total', $raw['meta']['page'] ?? []);
    }

    /** Datas inválidas caem no padrão (de agora até um ano depois), sem erro. */
    #[Test]
    public function datas_invalidas_caem_no_padrao(): void
    {
        $this->createDiscussion($this->eventCode());

        [$status, $body] = $this->agenda(2, ['from' => 'ontem', 'to' => '2030-13-45']);

        $this->assertEquals(200, $status);
        $this->assertSame([], $body['events'], 'o evento de 2030 fica fora do ano a partir de agora');
    }

    /** O cartão (GET /{id}) da discussão oculta também é 404 para quem não a vê. */
    #[Test]
    public function cartao_de_discussao_invisivel_responde_404(): void
    {
        $json = $this->createDiscussion($this->eventCode());
        $discussionId = (int) $json['data']['id'];
        $id = $this->eventId($discussionId);

        $this->database()->table('discussions')->where('id', $discussionId)->update(['hidden_at' => '2026-01-01 00:00:00', 'hidden_user_id' => 1]);

        [$member] = $this->getJson("/api/canela-events/$id", 2);
        [$admin] = $this->getJson("/api/canela-events/$id", 1);

        $this->assertEquals(404, $member);
        $this->assertEquals(200, $admin);
    }
}
