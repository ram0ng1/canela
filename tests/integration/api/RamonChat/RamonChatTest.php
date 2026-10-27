<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\RamonChat;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;
use Ramon\Canela\Tests\integration\RamonChatSchema;

/**
 * O que o tema põe por cima do ramon/chat: a MD consigo mesmo
 * (`POST /api/chat-channels/canela-self`), o nome do chat em grupo
 * (`POST /api/chat-channels/{id}/canela-name`, RenameChannelPolicy) e o "está
 * digitando" por consulta.
 *
 * Canais: 1 MD de 2 e 3; 2 MD arquivada de 2 e 3; 3 MD de 3 e 4 (a pessoa 2
 * fora dela).
 */
class RamonChatTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        // O ramon/chat não instala em todo banco de testes (RamonChatSchema).
        if ($reason = RamonChatSchema::unsupportedReason()) {
            $this->markTestSkipped($reason);
        }

        // Ver ResetsVisibilityScopers do ramon/chat: um conjunto de escopos por teste.
        foreach (['Ramon\Chat\Channel', 'Ramon\Chat\Message', 'Ramon\Chat\Thread', 'Ramon\Chat\Upload'] as $model) {
            (new \ReflectionProperty($model, 'visibilityScopers'))->setValue(null, []);
        }

        $this->extension('ramon-chat', 'ramon-canela');

        $now = Carbon::now()->toDateTimeString();

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'terceira', 'email' => 'terceira@machine.local', 'is_email_confirmed' => 1],
            ],
            'chat_channels' => [
                ['id' => 1, 'type' => 'direct', 'name' => null, 'slug' => 'md-1', 'status' => 'open', 'created_at' => $now, 'updated_at' => $now],
                ['id' => 2, 'type' => 'direct', 'name' => null, 'slug' => 'md-2', 'status' => 'archived', 'created_at' => $now, 'updated_at' => $now],
                ['id' => 3, 'type' => 'direct', 'name' => null, 'slug' => 'md-3', 'status' => 'open', 'created_at' => $now, 'updated_at' => $now],
            ],
            'chat_channel_user' => [
                ['channel_id' => 1, 'user_id' => 2, 'created_at' => $now],
                ['channel_id' => 1, 'user_id' => 3, 'created_at' => $now],
                ['channel_id' => 2, 'user_id' => 2, 'created_at' => $now],
                ['channel_id' => 2, 'user_id' => 3, 'created_at' => $now],
                ['channel_id' => 3, 'user_id' => 3, 'created_at' => $now],
                ['channel_id' => 3, 'user_id' => 4, 'created_at' => $now],
            ],
        ]);
    }

    private function rename(int $channelId, mixed $name, ?int $as = 2)
    {
        return $this->send($this->request('POST', "/api/chat-channels/$channelId/canela-name", ($as ? ['authenticatedAs' => $as] : []) + [
            'json' => ['data' => ['attributes' => ['name' => $name]]],
        ]));
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /** Quem participa renomeia a MD; o nome sai numa linha só, e a resposta é o documento do canal. */
    #[Test]
    public function participante_renomeia_o_grupo(): void
    {
        $response = $this->rename(1, "  Viagem\n de férias  ");

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('Viagem  de férias', Channel::query()->find(1)->name);

        $body = $this->body($response);

        $this->assertSame('chat-channels', $body['data']['type']);
        $this->assertSame('1', $body['data']['id']);
        $this->assertFalse($body['meta']['created']);
    }

    /** Nome vazio volta ao rótulo pelos participantes. */
    #[Test]
    public function nome_vazio_volta_ao_rotulo(): void
    {
        $this->rename(1, 'Grupo');
        $this->assertEquals(200, $this->rename(1, '   ')->getStatusCode());
        $this->assertNull(Channel::query()->find(1)->name);
    }

    /** Mais de 50 caracteres, ou um nome que não é texto: 422, e o nome não muda. */
    #[Test]
    public function nome_invalido_responde_422(): void
    {
        $this->assertEquals(422, $this->rename(1, str_repeat('a', 51))->getStatusCode());
        $this->assertEquals(422, $this->rename(1, ['a'])->getStatusCode());
        $this->assertNull(Channel::query()->find(1)->name);
        $this->assertEquals(200, $this->rename(1, str_repeat('a', 50))->getStatusCode());
    }

    /**
     * MD arquivada: 403. Quem saiu da conversa nem a vê mais pelo recurso de
     * canais do ramon/chat: 404 (antes do endpoint de ação, era 403).
     */
    #[Test]
    public function quem_nao_pode_renomear_e_recusado(): void
    {
        $this->assertEquals(403, $this->rename(2, 'Arquivada')->getStatusCode());

        $this->database()->table('chat_channel_user')->where('channel_id', 1)->where('user_id', 2)->update(['left_at' => Carbon::now()]);
        $this->assertEquals(404, $this->rename(1, 'Já saí')->getStatusCode());

        $this->assertNull(Channel::query()->find(1)->name);
        $this->assertNull(Channel::query()->find(2)->name);
    }

    #[Test]
    public function recurso_desligado_nao_renomeia(): void
    {
        $this->setting('canela.ramonchat_group_name', '0');

        $this->assertEquals(403, $this->rename(1, 'Grupo')->getStatusCode());
    }

    /** A MD de outras pessoas nem aparece para quem não participa, administrador incluído: 404. */
    #[Test]
    public function md_alheia_nao_se_renomeia(): void
    {
        $this->assertEquals(404, $this->rename(3, 'Intrusa')->getStatusCode());
        $this->assertEquals(404, $this->rename(3, 'Intrusa', 1)->getStatusCode());
        $this->assertNull(Channel::query()->find(3)->name);
    }

    /** "Anotar algo": cria a MD consigo mesmo uma vez (201) e depois a acha (200). */
    #[Test]
    public function md_consigo_mesmo_e_criada_uma_vez(): void
    {
        $first = $this->send($this->request('POST', '/api/chat-channels/canela-self', ['authenticatedAs' => 2]));

        $this->assertEquals(201, $first->getStatusCode(), (string) $first->getBody());

        $id = (int) $this->body($first)['data']['id'];

        $this->assertTrue($this->body($first)['meta']['created']);
        $this->assertSame([2], ChannelUser::query()->where('channel_id', $id)->pluck('user_id')->map('intval')->all());

        $second = $this->send($this->request('POST', '/api/chat-channels/canela-self', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $second->getStatusCode());
        $this->assertSame($id, (int) $this->body($second)['data']['id']);
        $this->assertFalse($this->body($second)['meta']['created']);
    }

    /** Sem a permissão de começar MDs do ramon/chat, ou com o recurso desligado: 403, nada criado. */
    #[Test]
    public function md_consigo_mesmo_pede_permissao(): void
    {
        $this->app();
        $this->database()->table('group_permission')->where('permission', 'ramon-chat.startDirect')->delete();

        $this->assertEquals(403, $this->send($this->request('POST', '/api/chat-channels/canela-self', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertSame(3, Channel::query()->count());
    }

    #[Test]
    public function md_consigo_mesmo_desligada(): void
    {
        $this->setting('canela.ramonchat_self_dm', '0');

        $this->assertEquals(403, $this->send($this->request('POST', '/api/chat-channels/canela-self', ['authenticatedAs' => 2]))->getStatusCode());
    }

    /** "Está digitando": só para quem participa do canal (os outros recebem a lista vazia). */
    #[Test]
    public function digitando_so_para_participantes(): void
    {
        $typing = fn (int $channel, ?int $as) => $this->send($this->request('GET', "/api/canela-ramon-chat/channels/$channel/typing", $as ? ['authenticatedAs' => $as] : []));

        $this->assertEquals(200, $typing(1, 2)->getStatusCode());
        $this->assertSame(['data' => []], $this->body($typing(3, 2)));
        $this->assertEquals(403, $typing(1, null)->getStatusCode());
    }
}
