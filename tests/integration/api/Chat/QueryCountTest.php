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
 * As listas do chat com dados suficientes para um N+1 aparecer: o detector
 * de consultas repetidas do flarum/testing reprova a requisição que fizer
 * uma consulta por mensagem, canal, fio ou usuário. Aqui só se confere que
 * cada lista responde e traz o que deve — a reprovação, se houver, é dele.
 *
 * O elenco: oito pessoas a mais (5 a 12), nove canais públicos seguidos pelo
 * membro comum (2), três MDs dele, e no canal 1 doze mensagens de autores
 * diferentes, com reações de várias pessoas, fixadas, uma resposta citada e
 * dois fios com respostas.
 */
class QueryCountTest extends AbstractChatTestCase
{
    private const AT = '2026-01-01 00:00:00';

    public function setUp(): void
    {
        parent::setUp();

        $users = [];
        $groupUser = [];

        foreach (range(5, 12) as $id) {
            $users[] = ['id' => $id, 'username' => "pessoa$id", 'email' => "pessoa$id@machine.local", 'password' => 'too-obscure', 'is_email_confirmed' => true];
            // Grupos variados: a permissão de cada pessoa sai deles.
            $groupUser[] = ['user_id' => $id, 'group_id' => $id % 2 ? 4 : 3];
        }

        $channels = [];
        $memberships = [];
        $messages = [];
        $reactions = [];
        $pins = [];
        $threads = [];
        $threadMemberships = [];

        // Canais 2 a 9: públicos, cada um com uma mensagem (a "última").
        foreach (range(2, 9) as $id) {
            $messageId = 100 + $id;
            $channels[] = ['id' => $id, 'type' => 'public', 'name' => "Canal $id", 'slug' => "canal-$id", 'status' => 0, 'threading_enabled' => true, 'user_count' => 2, 'last_message_id' => null, 'created_at' => self::AT, 'updated_at' => self::AT];
            $memberships[] = ['channel_id' => $id, 'user_id' => 2, 'following' => true, 'notification_level' => 1, 'last_read_message_id' => null];
            $memberships[] = ['channel_id' => $id, 'user_id' => $id + 3, 'following' => true, 'notification_level' => 1];
            $messages[] = ['id' => $messageId, 'channel_id' => $id, 'user_id' => $id + 3, 'message' => "Oi do canal $id", 'cooked' => "<p>Oi do canal $id</p>", 'created_at' => self::AT, 'updated_at' => self::AT];
        }

        // MDs 10 a 12, do 2 com duas pessoas cada.
        foreach (range(10, 12) as $id) {
            $channels[] = ['id' => $id, 'type' => 'direct', 'is_group' => true, 'slug' => 'dm', 'status' => 0, 'threading_enabled' => true, 'user_count' => 3, 'direct_key' => "k$id", 'created_at' => self::AT, 'updated_at' => self::AT];
            $memberships[] = ['channel_id' => $id, 'user_id' => 2, 'following' => true, 'notification_level' => 2];
            $memberships[] = ['channel_id' => $id, 'user_id' => $id - 5, 'following' => true, 'notification_level' => 2];
            $memberships[] = ['channel_id' => $id, 'user_id' => $id - 4, 'following' => true, 'notification_level' => 2];
        }

        // Canal 1: doze mensagens, de autores diferentes, com reações.
        foreach (range(1, 12) as $n) {
            $author = $n <= 8 ? $n + 4 : 2;
            $messages[] = ['id' => $n, 'channel_id' => 1, 'user_id' => $author, 'message' => "Mensagem $n sobre o assunto", 'cooked' => "<p>Mensagem $n sobre o assunto</p>", 'in_reply_to_id' => $n === 12 ? 11 : null, 'created_at' => self::AT, 'updated_at' => self::AT];
            $reactions[] = ['message_id' => $n, 'user_id' => 2, 'emoji' => '👍', 'created_at' => self::AT];
            $reactions[] = ['message_id' => $n, 'user_id' => (($n + 1) % 8) + 5, 'emoji' => '🎉', 'created_at' => self::AT];

            if ($n % 3 === 0) {
                $pins[] = ['channel_id' => 1, 'message_id' => $n, 'pinned_by_id' => 3, 'created_at' => self::AT, 'updated_at' => self::AT];
            }

            $memberships[] = ['channel_id' => 1, 'user_id' => $author, 'following' => true, 'notification_level' => 1];
        }

        // Dois fios, nas mensagens 1 e 2, com duas respostas cada.
        foreach ([1, 2] as $t) {
            $replies = [200 + $t * 10, 201 + $t * 10];

            foreach ($replies as $i => $replyId) {
                $messages[] = ['id' => $replyId, 'channel_id' => 1, 'user_id' => 5 + $i + $t, 'thread_id' => $t, 'message' => "Resposta $replyId", 'cooked' => "<p>Resposta $replyId</p>", 'created_at' => self::AT, 'updated_at' => self::AT];
            }

            $threads[] = ['id' => $t, 'channel_id' => 1, 'original_message_id' => $t, 'original_message_user_id' => $t + 4, 'last_message_id' => $replies[1], 'replies_count' => 2, 'created_at' => self::AT, 'updated_at' => self::AT];
            $threadMemberships[] = ['thread_id' => $t, 'user_id' => 2, 'notification_level' => 2, 'last_read_message_id' => $t];
        }

        // A tabela de canais primeiro sem a última mensagem (a chave
        // estrangeira das mensagens pede o canal).
        $this->prepareDatabase([
            // A mesma chave do elenco da base: com 'users', uma lista apagaria a outra.
            User::class => $users,
            'group_user' => $groupUser,
            'canela_chat_channels' => $channels,
            'canela_chat_memberships' => array_values(array_unique($memberships, SORT_REGULAR)),
            'canela_chat_messages' => array_map(static fn (array $m) => $m + ['thread_id' => null, 'in_reply_to_id' => null], $messages),
        ]);

        $this->prepareDatabase([
            'canela_chat_threads' => $threads,
            'canela_chat_thread_memberships' => $threadMemberships,
            'canela_chat_reactions' => $reactions,
            'canela_chat_pins' => $pins,
        ]);

        foreach (range(2, 9) as $id) {
            $this->database()->table('canela_chat_channels')->where('id', $id)->update(['last_message_id' => 100 + $id]);
        }

        $this->database()->table('canela_chat_channels')->where('id', 1)->update(['last_message_id' => 12]);
        $this->database()->table('canela_chat_messages')->whereIn('id', [1, 2])->update(['thread_id' => $this->database()->raw('id')]);
    }

    #[Test]
    public function mensagens_do_canal(): void
    {
        [$status, $body] = $this->messages(1, 2);

        $this->assertEquals(200, $status, json_encode($body));
        // A conversa principal: as doze (as originais dos fios entre elas).
        $this->assertCount(12, $body['data']);
        $this->assertCount(2, array_filter(self::data($body), static fn ($m) => $m['thread'] !== null));
        $this->assertNotEmpty(self::includedIds($body, 'users'));
        $this->assertFalse($body['meta']['canLoadMorePast']);
    }

    #[Test]
    public function mensagens_de_um_fio(): void
    {
        [$status, $body] = $this->messages(1, 2, ['thread' => 1]);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertCount(3, $body['data']);
    }

    #[Test]
    public function estado_e_lista_de_canais(): void
    {
        [$state, $stateBody] = $this->api('GET', '/chat-channels/state', 2);
        [$browse, $browseBody] = $this->api('GET', '/chat-channels', 2);

        $this->assertEquals(200, $state, json_encode($stateBody));
        $this->assertCount(12, $stateBody['data']);
        $this->assertEquals(200, $browse, json_encode($browseBody));
        $this->assertCount(9, $browseBody['data']);
    }

    #[Test]
    public function fios(): void
    {
        [$mine, $mineBody] = $this->api('GET', '/chat-threads', 2);
        [$channel, $channelBody] = $this->api('GET', '/chat-threads', 2, null, ['filter' => ['channel' => 1]]);

        $this->assertEquals(200, $mine, json_encode($mineBody));
        $this->assertCount(2, $mineBody['data']);
        $this->assertEquals(['1'], self::includedIds($mineBody, 'chat-channels'));
        $this->assertEquals(200, $channel, json_encode($channelBody));
        $this->assertCount(2, $channelBody['data']);
    }

    #[Test]
    public function busca_fixadas_e_polling(): void
    {
        [$search, $searchBody] = $this->api('GET', '/chat-messages/search', 2, null, ['filter' => ['q' => 'assunto']]);
        [$pins, $pinsBody] = $this->api('GET', '/chat-channels/1/pins', 2);
        [$updates, $updatesBody] = $this->api('GET', '/chat-channels/1/updates', 2, null, ['filter' => ['after' => 1, 'since' => '2025-12-31T00:00:00+00:00']]);

        $this->assertEquals(200, $search, json_encode($searchBody));
        $this->assertCount(12, $searchBody['data']);
        $this->assertEquals(200, $pins, json_encode($pinsBody));
        $this->assertCount(4, $pinsBody['data']);
        $this->assertEquals(200, $updates, json_encode($updatesBody));
        $this->assertCount(11, $updatesBody['meta']['newIds']);
    }

    /** A busca junta mensagens de muitos canais: ainda uma consulta por tipo de dado. */
    #[Test]
    public function busca_em_varios_canais(): void
    {
        [$status, $body] = $this->api('GET', '/chat-messages/search', 2, null, ['filter' => ['q' => 'canal']]);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertCount(8, $body['data']);
        $this->assertCount(8, self::includedIds($body, 'chat-channels'));
    }

    #[Test]
    public function membros_e_busca_de_pessoas(): void
    {
        [$members, $membersBody] = $this->api('GET', '/chat-channels/1/members', 2);
        [$people, $peopleBody] = $this->api('GET', '/users/canela-chat-search', 2, null, ['filter' => ['channel' => 1]]);

        $this->assertEquals(200, $members, json_encode($membersBody));
        $this->assertCount(10, $membersBody['data']);
        $this->assertEquals(200, $people, json_encode($peopleBody));
        $this->assertCount(10, $peopleBody['data']);
    }
}
