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

use PHPUnit\Framework\Attributes\Test;

/**
 * Canais: as portas de entrada da API (chat ligado, logado, no grupo
 * permitido), criar, listar e abrir.
 */
class ChannelsTest extends AbstractChatTestCase
{
    /**
     * Com `canela.chat_enabled` desligado as rotas continuam registradas, mas
     * respondem 404, como se o chat não existisse.
     */
    #[Test]
    public function chat_desligado_responde_404(): void
    {
        $this->setting('canela.chat_enabled', '0');

        [$status] = $this->chat('GET', '/channels', 2);

        $this->assertEquals(404, $status);
    }

    /** Visitante não usa o chat: 401. */
    #[Test]
    public function visitante_recebe_401(): void
    {
        [$status] = $this->chat('GET', '/channels', null);

        $this->assertEquals(401, $status);
    }

    /**
     * Só os grupos de `canela.chat_allowed_groups` usam o chat (o
     * administrador sempre). Fora deles: 403.
     */
    #[Test]
    public function usuario_fora_dos_grupos_permitidos_recebe_403(): void
    {
        $this->setting('canela.chat_allowed_groups', '4');

        [$normal] = $this->chat('GET', '/channels', 2);
        [$moderator] = $this->chat('GET', '/channels', 3);
        [$admin] = $this->chat('GET', '/channels', 1);

        $this->assertEquals(403, $normal);
        $this->assertEquals(200, $moderator);
        $this->assertEquals(200, $admin);
    }

    /** Quem desligou o chat nas preferências também fica de fora. */
    #[Test]
    public function preferencia_pessoal_desligada_recebe_403(): void
    {
        $this->prepareDatabase([
            'users' => [
                ['id' => 5, 'username' => 'semchat', 'email' => 'semchat@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => true, 'preferences' => json_encode(['canelaChatEnabled' => false])],
            ],
        ]);

        [$status] = $this->chat('GET', '/channels', 5);

        $this->assertEquals(403, $status);
    }

    /** O administrador cria um canal público e já entra nele. */
    #[Test]
    public function admin_cria_canal(): void
    {
        [$status, $body] = $this->chat('POST', '/channels', 1, ['name' => 'Anúncios', 'description' => 'Novidades']);

        $this->assertEquals(200, $status, json_encode($body));
        $this->assertEquals('Anúncios', $body['channel']['name']);
        $this->assertEquals('anuncios', $body['channel']['slug']);
        $this->assertEquals('public', $body['channel']['type']);
        $this->assertTrue($body['channel']['membership']['following']);
        $this->assertEquals(1, $body['channel']['userCount']);
    }

    /** Membro comum não cria canal (por padrão, só os administradores). */
    #[Test]
    public function membro_comum_nao_cria_canal(): void
    {
        [$status] = $this->chat('POST', '/channels', 2, ['name' => 'Meu canal']);

        $this->assertEquals(403, $status);
    }

    /** Com o grupo dele em `canela.chat_create_channel_groups`, o membro cria. */
    #[Test]
    public function membro_cria_canal_com_o_grupo_liberado(): void
    {
        $this->setting('canela.chat_create_channel_groups', '3');

        [$status, $body] = $this->chat('POST', '/channels', 2, ['name' => 'Meu canal']);

        $this->assertEquals(200, $status, json_encode($body));
    }

    /** Canal público sem nome não passa na validação: 422. */
    #[Test]
    public function canal_sem_nome_responde_422(): void
    {
        [$status, $body] = $this->chat('POST', '/channels', 1, ['name' => '   ']);

        $this->assertEquals(422, $status);
        $this->assertEquals('/data/attributes/name', $body['errors'][0]['source']['pointer']);
    }

    /** Slug pedido explicitamente e já em uso: 422. */
    #[Test]
    public function slug_repetido_responde_422(): void
    {
        [$status] = $this->chat('POST', '/channels', 1, ['name' => 'Outro', 'slug' => 'geral']);

        $this->assertEquals(422, $status);
    }

    /** A lista traz os canais públicos; abrir um mostra o estado do ator. */
    #[Test]
    public function lista_e_abre_canal(): void
    {
        [$status, $body] = $this->chat('GET', '/channels', 4);

        $this->assertEquals(200, $status);
        $this->assertEquals(['Geral'], array_column($body['channels'], 'name'));
        $this->assertFalse($body['hasMore']);

        $channel = $this->channelFor(1, 4);

        $this->assertNull($channel['membership']);
        $this->assertFalse($channel['canPost']);
        $this->assertEquals('not_member', $channel['cannotPostReason']);
        $this->assertFalse($channel['canModerate']);
    }

    /** Canal que não existe: 404. */
    #[Test]
    public function canal_inexistente_responde_404(): void
    {
        [$status] = $this->chat('GET', '/channels/999', 2);

        $this->assertEquals(404, $status);
    }

    /** Arquivados ficam fora do "tudo" de quem não modera; a moderação os vê. */
    #[Test]
    public function arquivados_so_aparecem_para_a_moderacao(): void
    {
        $this->prepareDatabase([
            'canela_chat_channels' => [
                ['id' => 2, 'type' => 'public', 'name' => 'Antigo', 'slug' => 'antigo', 'status' => 3, 'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00'],
            ],
        ]);

        [, $member] = $this->chat('GET', '/channels', 2);
        [, $moderator] = $this->chat('GET', '/channels', 3);

        $this->assertNotContains('Antigo', array_column($member['channels'], 'name'));
        $this->assertContains('Antigo', array_column($moderator['channels'], 'name'));
    }

    /** Só a moderação muda e apaga o canal. */
    #[Test]
    public function so_a_moderacao_edita_e_apaga_canal(): void
    {
        [$editDenied] = $this->chat('PATCH', '/channels/1', 2, ['name' => 'Hackeado']);
        [$deleteDenied] = $this->chat('DELETE', '/channels/1', 2);

        $this->assertEquals(403, $editDenied);
        $this->assertEquals(403, $deleteDenied);

        [$edited, $body] = $this->chat('PATCH', '/channels/1', 3, ['name' => 'Geral 2', 'status' => 'closed']);
        $this->assertEquals(200, $edited, json_encode($body));
        $this->assertEquals('Geral 2', $body['channel']['name']);
        $this->assertEquals('closed', $body['channel']['status']);

        [$deleted] = $this->chat('DELETE', '/channels/1', 3);
        $this->assertEquals(204, $deleted);
        $this->assertNull($this->database()->table('canela_chat_channels')->find(1));
    }

    /** Arquivado não volta a abrir: 422. */
    #[Test]
    public function canal_arquivado_nao_reabre(): void
    {
        $this->chat('PATCH', '/channels/1', 1, ['status' => 'archived']);

        [$status] = $this->chat('PATCH', '/channels/1', 1, ['status' => 'open']);

        $this->assertEquals(422, $status);
    }
}
