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

use Flarum\Tags\Tag;
use PHPUnit\Framework\Attributes\Test;

/**
 * Canais de uma tag: as permissões da tag valem para o canal. Quem não vê a
 * tag restrita não vê o canal (404), nem na lista, nem para ler ou escrever.
 */
class TagChannelsTest extends AbstractChatTestCase
{
    protected array $extraExtensions = ['flarum-tags'];

    public function setUp(): void
    {
        parent::setUp();

        $this->prepareDatabase([
            Tag::class => [
                ['id' => 1, 'name' => 'Aberta', 'slug' => 'aberta', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Equipe', 'slug' => 'equipe', 'position' => 1, 'parent_id' => null, 'is_restricted' => true],
            ],
            'group_permission' => [
                ['permission' => 'tag2.viewForum', 'group_id' => 4],
            ],
            'canela_chat_channels' => [
                ['id' => 2, 'type' => 'public', 'tag_id' => 1, 'name' => 'Da aberta', 'slug' => 'da-aberta', 'status' => 0, 'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00'],
                ['id' => 3, 'type' => 'public', 'tag_id' => 2, 'name' => 'Da equipe', 'slug' => 'da-equipe', 'status' => 0, 'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00'],
            ],
            'canela_chat_memberships' => [
                // Uma participação antiga não fura a restrição da tag.
                ['channel_id' => 3, 'user_id' => 2, 'following' => true, 'notification_level' => 1],
                ['channel_id' => 3, 'user_id' => 3, 'following' => true, 'notification_level' => 1],
            ],
        ]);
    }

    /** A lista mostra o canal da tag restrita só para quem vê a tag. */
    #[Test]
    public function lista_respeita_a_tag(): void
    {
        [, $member] = $this->api('GET', '/chat-channels', 2);
        [, $moderator] = $this->api('GET', '/chat-channels', 3);

        $this->assertEqualsCanonicalizing(['Geral', 'Da aberta'], array_column(self::data($member), 'name'));
        $this->assertEqualsCanonicalizing(['Geral', 'Da aberta', 'Da equipe'], array_column(self::data($moderator), 'name'));
    }

    /** Sem ver a tag: abrir, ler, escrever e entrar respondem 404. */
    #[Test]
    public function sem_ver_a_tag_nao_le_nem_escreve(): void
    {
        $message = $this->post(3, 3, 'Só para a equipe');

        [$show] = $this->api('GET', '/chat-channels/3', 2);
        [$read] = $this->messages(3, 2);
        [$single] = $this->api('GET', "/chat-messages/$message", 2);
        [$write] = $this->sendMessage(3, 2, 'Oi');
        [$join] = $this->api('POST', '/chat-channels/3/membership', 4);

        $this->assertEquals(404, $show);
        $this->assertEquals(404, $read);
        $this->assertEquals(404, $single);
        $this->assertEquals(404, $write);
        $this->assertEquals(404, $join);

        [, $state] = $this->api('GET', '/chat-channels/state', 2);
        $this->assertNotContains(3, array_column(self::data($state), 'id'));
    }

    /** Criar canal numa tag que o ator não vê: 422 em `tagId`. */
    #[Test]
    public function criar_canal_em_tag_invisivel_responde_422(): void
    {
        $this->grant('canela.chat.createChannel', [3]);

        [$status, $body] = $this->api('POST', '/chat-channels', 2, self::document('chat-channels', ['name' => 'Infiltrado', 'tagId' => 2]));
        [$allowed, $created] = $this->api('POST', '/chat-channels', 2, self::document('chat-channels', ['name' => 'Na aberta', 'tagId' => 1]));

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/tagId', $body['errors'][0]['source']['pointer']);
        $this->assertEquals(201, $allowed);
        $this->assertEquals(1, self::data($created)['tag']['id']);
    }
}
