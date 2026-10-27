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

        [$status, $going] = $this->invitees($id);
        $this->assertEquals(200, $status);
        $this->assertEquals('going', $going['status']);
        $this->assertEquals(['normal'], array_column($going['users'], 'username'));
        $this->assertEquals(['going' => 1, 'interested' => 0, 'not_going' => 1], $going['counts']);
        $this->assertSame(['users'], array_values($going['types']));

        [, $notGoing] = $this->invitees($id, 1, ['filter' => ['status' => 'not_going']]);
        $this->assertEquals(['outro'], array_column($notGoing['users'], 'username'));

        // Só o público da pessoa sai na lista (nem para o admin).
        $this->assertArrayNotHasKey('email', $going['users'][0]);
        $this->assertArrayNotHasKey('email', $notGoing['users'][0]);
        $this->assertSame(['id', 'username', 'displayName', 'avatarUrl', 'slug'], array_keys($notGoing['users'][0]));
    }

    /** Evento inexistente: 404. */
    #[Test]
    public function evento_inexistente_responde_404(): void
    {
        [$status] = $this->rsvp(999, 2, 'going');

        $this->assertEquals(404, $status);
    }
    /**
     * A habilidade `rsvp` (CalendarEventPolicy): quem pode responder ao tópico
     * pode responder à presença; visitante, não.
     */
    #[Test]
    public function policy_da_presenca(): void
    {
        $id = $this->event();
        $event = \Ramon\Canela\Events\CalendarEvent::query()->findOrFail($id);

        $this->assertTrue(\Flarum\User\User::query()->findOrFail(2)->can('rsvp', $event));
        $this->assertFalse((new \Flarum\User\Guest())->can('rsvp', $event));
        // Sem `discussion.reply`, a resposta é recusada: topico_sem_permissao_de_responder_responde_403.
    }

    /**
     * O status precisa ser texto da lista (RsvpValidator); sem status, a
     * resposta sai, como com null.
     */
    #[Test]
    public function validacao_do_status(): void
    {
        $id = $this->event();

        [$number] = $this->rsvp($id, 2, 1);
        [$list] = $this->rsvp($id, 2, ['going']);

        $this->assertEquals(422, $number);
        $this->assertEquals(422, $list);
        $this->assertSame(0, $this->database()->table('canela_event_invitees')->count());

        $this->rsvp($id, 2, 'going');

        $response = $this->send($this->request('POST', "/api/canela-events/$id/rsvp", [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-events', 'id' => (string) $id, 'attributes' => []]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame(0, $this->database()->table('canela_event_invitees')->count());
    }

    /** Visitante não responde à presença: 401. */
    #[Test]
    public function visitante_nao_responde(): void
    {
        $id = $this->event();

        $response = $this->send($this->request('POST', "/api/canela-events/$id/rsvp", [
            'json' => ['data' => ['type' => 'canela-events', 'id' => (string) $id, 'attributes' => ['status' => 'going']]],
        ])->withAttribute('bypassCsrfToken', true));

        $this->assertEquals(401, $response->getStatusCode());
        $this->assertSame(0, $this->database()->table('canela_event_invitees')->count());
    }

    /** GET /api/canela-events/{id}: o cartão, do ponto de vista de quem pede. */
    #[Test]
    public function cartao_do_evento(): void
    {
        $id = $this->event();
        $this->rsvp($id, 2, 'interested');

        [$status, $body] = $this->getJson("/api/canela-events/$id", 2);

        $this->assertEquals(200, $status);
        $this->assertSame('canela-events', $body['data']['type']);
        $this->assertSame('interested', $body['data']['attributes']['myStatus']);
        $this->assertSame(1, $body['data']['attributes']['interested']);
        $this->assertSame('Praça Central', $body['data']['attributes']['location']);
        $this->assertTrue($body['data']['attributes']['canRsvp']);

        [, $guest] = $this->getJson("/api/canela-events/$id");

        $this->assertNull($guest['data']['attributes']['myStatus']);
        $this->assertFalse($guest['data']['attributes']['canRsvp']);
    }
}
