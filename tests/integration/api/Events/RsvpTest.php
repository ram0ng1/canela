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
 * Presença: POST /api/canela-events/{id}/rsvp (vou, interessado, não vou,
 * null tira a resposta) e GET …/invitees.
 */
class RsvpTest extends AbstractEventsTestCase
{
    private function event(string $attributes = ''): int
    {
        $json = $this->createDiscussion($this->eventCode($attributes));

        return (int) $this->eventId((int) $json['data']['id']);
    }

    /** Responder, trocar e tirar a resposta mexem nos três contadores. */
    #[Test]
    public function responder_trocar_e_tirar_a_presenca(): void
    {
        $id = $this->event();

        [$status, $body] = $this->rsvp($id, 2, 'going');
        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('going', $body['event']['myStatus']);
        $this->assertEquals(1, $body['event']['going']);
        $this->assertEquals(['2'], array_column($body['event']['sample'], 'id'));

        [, $body] = $this->rsvp($id, 2, 'interested');
        $this->assertEquals(0, $body['event']['going']);
        $this->assertEquals(1, $body['event']['interested']);

        [, $body] = $this->rsvp($id, 2, null);
        $this->assertNull($body['event']['myStatus']);
        $this->assertEquals(0, $body['event']['interested']);
        $this->assertSame(0, $this->database()->table('canela_event_invitees')->count());
    }

    /** Status fora da lista: 422. */
    #[Test]
    public function status_invalido_responde_422(): void
    {
        $id = $this->event();

        [$status] = $this->rsvp($id, 2, 'maybe');

        $this->assertEquals(422, $status);
    }

    /**
     * Com vagas (`max`), só o "vou" conta: lotado, o próximo "vou" recebe 422,
     * mas "interessado" continua aceito, e quem já ia não perde a vaga.
     */
    #[Test]
    public function evento_lotado_recusa_o_proximo_vou(): void
    {
        $id = $this->event('max="1"');

        [$first, $body] = $this->rsvp($id, 2, 'going');
        $this->assertEquals(200, $first);
        $this->assertTrue($body['event']['full']);

        [$second] = $this->rsvp($id, 3, 'going');
        [$interested] = $this->rsvp($id, 3, 'interested');
        [$again] = $this->rsvp($id, 2, 'going');

        $this->assertEquals(422, $second);
        $this->assertEquals(200, $interested);
        $this->assertEquals(200, $again);
    }

    /** "Standalone" é só o aviso, sem presença: 404. */
    #[Test]
    public function evento_sem_presenca_responde_404(): void
    {
        $id = $this->event('status="standalone"');

        [$status] = $this->rsvp($id, 2, 'going');

        $this->assertEquals(404, $status);
    }

    /** Responder à presença é como responder ao tópico: trancado, 403. */
    #[Test]
    public function topico_sem_permissao_de_responder_responde_403(): void
    {
        $id = $this->event();

        $this->database()->table('group_permission')->where('permission', 'discussion.reply')->delete();

        [$status] = $this->rsvp($id, 2, 'going');

        $this->assertEquals(403, $status);
    }

    /** Primeiro post oculto pela moderação: o evento não aceita resposta (404). */
    #[Test]
    public function primeiro_post_oculto_responde_404(): void
    {
        $id = $this->event();

        $this->database()->table('posts')->where('number', 1)->update(['hidden_at' => '2026-01-01 00:00:00', 'hidden_user_id' => 1]);

        [$status] = $this->rsvp($id, 2, 'going');

        $this->assertEquals(404, $status);
    }

    /** A lista de convidados por status, com os contadores; visitante também lê. */
    #[Test]
    public function lista_os_convidados_por_status(): void
    {
        $id = $this->event();
        $this->rsvp($id, 2, 'going');
        $this->rsvp($id, 3, 'not_going');

        [$status, $going] = $this->getJson("/api/canela-events/$id/invitees");
        $this->assertEquals(200, $status);
        $this->assertEquals('going', $going['status']);
        $this->assertEquals(['normal'], array_column($going['users'], 'username'));
        $this->assertEquals(['going' => 1, 'interested' => 0, 'not_going' => 1], $going['counts']);

        [, $notGoing] = $this->getJson("/api/canela-events/$id/invitees", 1, ['status' => 'not_going']);
        $this->assertEquals(['outro'], array_column($notGoing['users'], 'username'));

        // Só o público da pessoa sai na lista.
        $this->assertArrayNotHasKey('email', $going['users'][0]);
    }

    /** Evento inexistente: 404. */
    #[Test]
    public function evento_inexistente_responde_404(): void
    {
        [$status] = $this->rsvp(999, 2, 'going');

        $this->assertEquals(404, $status);
    }
}
