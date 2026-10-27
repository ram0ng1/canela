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

use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * Os endpoints de ação dos recursos do chat que os outros testes não cobrem:
 * o polling, a busca, os membros, a busca de pessoas, "digitando", o "já vi"
 * das fixadas, "Meus tópicos" e as portas (chat desligado, visitante) dos
 * endpoints de um canal.
 */
class ActionsTest extends AbstractChatTestCase
{
    /**
     * O polling traz as novas (depois de `after`), as que mudaram desde
     * `since` e, para quem não as vê mais, os ids das apagadas.
     */
    #[Test]
    public function polling_traz_novas_mudadas_e_removidas(): void
    {
        $edited = $this->post(1, 3, 'Primeira');
        $removed = $this->post(1, 3, 'Segunda');
        $after = $this->post(1, 3, 'Terceira');

        $this->database()->table('canela_chat_messages')->where('id', '<=', $after)->update(['updated_at' => '2026-01-01 00:00:00']);

        $this->api('PATCH', "/chat-messages/$edited", 3, self::document('chat-messages', ['message' => 'Primeira, editada']));
        $this->api('DELETE', "/chat-messages/$removed", 3);
        $new = $this->post(1, 3, 'Quarta');

        [$status, $body] = $this->api('GET', '/chat-channels/1/updates', 2, null, ['filter' => ['after' => $after, 'since' => '2026-06-01T00:00:00+00:00']]);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals([$new], $body['meta']['newIds']);
        $this->assertEqualsCanonicalizing([$new, $edited], array_column(self::data($body), 'id'));
        $this->assertEquals([$removed], $body['meta']['removedIds']);
        $this->assertSame([], $body['meta']['typingUserIds']);
        $this->assertNotEmpty($body['meta']['now']);
    }

    /** "Digitando" responde 204 e aparece no polling dos outros, com a pessoa no `included`. */
    #[Test]
    public function digitando_aparece_no_polling(): void
    {
        [$typing] = $this->api('POST', '/chat-channels/1/typing', 3, ['typing' => true]);
        [, $body] = $this->api('GET', '/chat-channels/1/updates', 2);
        [, $own] = $this->api('GET', '/chat-channels/1/updates', 3);

        $this->assertEquals(204, $typing);
        $this->assertEquals([3], $body['meta']['typingUserIds']);
        $this->assertContains('3', self::includedIds($body, 'users'));
        // Quem digita não se vê digitando.
        $this->assertSame([], $own['meta']['typingUserIds']);
    }

    /** A busca acha nos canais que o ator enxerga, com o canal incluído; "Últimos" ordena pelas mais novas. */
    #[Test]
    public function busca_nas_mensagens(): void
    {
        $older = $this->post(1, 3, 'Uma palavra perdida');
        $newer = $this->post(1, 3, 'Palavras ao vento');

        [$status, $relevance] = $this->api('GET', '/chat-messages/search', 2, null, ['filter' => ['q' => 'palavra']]);
        [, $latest] = $this->api('GET', '/chat-messages/search', 2, null, ['filter' => ['q' => 'palavra'], 'sort' => '-createdAt']);
        [, $short] = $this->api('GET', '/chat-messages/search', 2, null, ['filter' => ['q' => 'p']]);

        $this->assertEquals(200, $status, json_encode($relevance));
        // A palavra inteira vem primeiro.
        $this->assertEquals([$older, $newer], array_column(self::data($relevance), 'id'));
        $this->assertEquals([$newer, $older], array_column(self::data($latest), 'id'));
        $this->assertEquals(['1'], self::includedIds($relevance, 'chat-channels'));
        $this->assertSame([], $short['data']);
    }

    /** Os membros por nome de usuário, com o filtro "Encontrar membros" e o total. */
    #[Test]
    public function membros_do_canal(): void
    {
        [$status, $body] = $this->api('GET', '/chat-channels/1/members', 4);
        [, $filtered] = $this->api('GET', '/chat-channels/1/members', 4, null, ['filter' => ['q' => 'mod']]);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals(['3', '2'], array_column($body['data'], 'id'));
        $this->assertEquals('users', $body['data'][0]['type']);
        $this->assertFalse($body['meta']['hasMore']);
        $this->assertEquals(2, $body['meta']['total']);
        $this->assertEquals(['3'], array_column($filtered['data'], 'id'));
    }

    /** Adicionar membros é da moderação num canal público: o membro comum recebe 403. */
    #[Test]
    public function adicionar_membros(): void
    {
        [$denied] = $this->api('POST', '/chat-channels/1/members', 2, ['userIds' => [4]]);
        [$status, $body] = $this->api('POST', '/chat-channels/1/members', 3, ['userIds' => [4]]);

        $this->assertEquals(403, $denied);
        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals(3, self::data($body)['userCount']);
    }

    /**
     * A busca de pessoas: por prefixo, só quem pode usar o chat, com os
     * membros do canal primeiro e marcados em `meta.memberIds`.
     */
    #[Test]
    public function busca_de_pessoas(): void
    {
        $this->prepareDatabase([
            User::class => [
                ['id' => 5, 'username' => 'outra', 'email' => 'outra@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => true, 'preferences' => json_encode(['canelaChatEnabled' => false])],
            ],
        ]);

        [$status, $body] = $this->api('GET', '/users/canela-chat-search', 2, null, ['filter' => ['q' => '@out', 'channel' => 1]]);
        [, $members] = $this->api('GET', '/users/canela-chat-search', 4, null, ['filter' => ['q' => 'mod', 'channel' => 1]]);
        [$hidden] = $this->api('GET', '/users/canela-chat-search', 2, null, ['filter' => ['q' => 'mod', 'channel' => 999]]);

        $this->assertEquals(200, $status, json_encode($body));
        // "outra" desligou o chat: não aparece.
        $this->assertEquals(['4'], array_column($body['data'], 'id'));
        $this->assertSame([], $body['meta']['memberIds']);
        $this->assertEquals([3], $members['meta']['memberIds']);
        $this->assertEquals(404, $hidden);
    }

    /** O "já vi" das fixadas responde 204 e apaga o pontinho. */
    #[Test]
    public function fixadas_vistas(): void
    {
        $id = $this->post(1, 2, 'Importante');
        $this->api('POST', "/chat-messages/$id/pin", 3);

        $this->assertTrue($this->channelFor(1, 2)['membership']['hasUnseenPins']);

        [$status] = $this->api('POST', '/chat-channels/1/pins-read', 2);

        $this->assertEquals(204, $status);
        $this->assertFalse($this->channelFor(1, 2)['membership']['hasUnseenPins']);
    }

    /** "Meus tópicos": os fios que o ator acompanha, com o canal incluído; silenciar tira da lista. */
    #[Test]
    public function meus_topicos(): void
    {
        $original = $this->post(1, 2, 'Pergunta');
        [, $reply] = $this->sendMessage(1, 3, 'Resposta', ['inReplyToId' => $original]);
        $threadId = self::data($reply)['threadId'];

        [$status, $body] = $this->api('GET', '/chat-threads', 2);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals([$threadId], array_column(self::data($body), 'id'));
        $this->assertEquals(['1'], self::includedIds($body, 'chat-channels'));

        [$muted, $thread] = $this->api('PATCH', "/chat-threads/$threadId", 2, self::document('chat-threads', ['notificationLevel' => 'muted']));
        [, $after] = $this->api('GET', '/chat-threads', 2);

        $this->assertEquals(200, $muted, json_encode($thread));
        $this->assertEquals('muted', self::data($thread)['membership']['notificationLevel']);
        $this->assertSame([], $after['data']);
    }

    /** As ações de um canal pedem login: 401 ao visitante. */
    #[Test]
    public function visitante_nas_acoes_recebe_401(): void
    {
        // Um GET: o POST do visitante para antes, no CSRF.
        [$pins] = $this->api('GET', '/chat-channels/1/pins', null);
        [$show] = $this->api('GET', '/chat-channels/1', null);
        [$threads] = $this->api('GET', '/chat-threads', null);

        $this->assertEquals(401, $pins);
        $this->assertEquals(401, $show);
        $this->assertEquals(401, $threads);
    }

    /** Com o chat desligado, as ações e a busca de pessoas também respondem 404. */
    #[Test]
    public function chat_desligado_nas_acoes_responde_404(): void
    {
        $this->setting('canela.chat_enabled', '0');

        [$read] = $this->api('POST', '/chat-channels/1/read', 2);
        [$state] = $this->api('GET', '/chat-channels/state', 2);
        [$messages] = $this->messages(1, 2);
        [$people] = $this->api('GET', '/users/canela-chat-search', 2);
        [$upload] = $this->api('POST', '/chat/uploads', 2);

        $this->assertEquals(404, $read);
        $this->assertEquals(404, $state);
        $this->assertEquals(404, $messages);
        $this->assertEquals(404, $people);
        $this->assertEquals(404, $upload);
    }

    /** Lista de mensagens sem o canal no filtro: 404 (não existe "todas as mensagens"). */
    #[Test]
    public function mensagens_sem_canal_respondem_404(): void
    {
        [$status] = $this->api('GET', '/chat-messages', 2);

        $this->assertEquals(404, $status);
    }

    /** O cursor: `page[before]` traz as anteriores e diz se há mais. */
    #[Test]
    public function cursor_das_mensagens(): void
    {
        $ids = [];

        foreach (range(1, 5) as $n) {
            $ids[] = $this->post(1, 3, "Mensagem $n");
        }

        [, $last] = $this->messages(1, 2, [], ['limit' => 2]);
        [, $before] = $this->messages(1, 2, [], ['before' => $ids[3], 'limit' => 2]);
        [, $around] = $this->messages(1, 2, [], ['around' => $ids[2], 'limit' => 2]);

        $this->assertEquals([$ids[3], $ids[4]], array_column(self::data($last), 'id'));
        $this->assertTrue($last['meta']['canLoadMorePast']);
        $this->assertFalse($last['meta']['canLoadMoreFuture']);
        $this->assertEquals([$ids[1], $ids[2]], array_column(self::data($before), 'id'));
        $this->assertTrue($before['meta']['canLoadMoreFuture']);
        $this->assertEquals([$ids[2], $ids[3]], array_column(self::data($around), 'id'));
        $this->assertEquals($ids[2], $around['meta']['targetMessageId']);
    }
}
