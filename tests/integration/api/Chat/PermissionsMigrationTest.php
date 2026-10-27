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
 * A migration que troca as listas de grupos das configurações
 * (`canela.chat_*_groups`) pelas permissões do chat: semeia cada permissão com
 * os grupos que a configuração tinha (ou com o padrão de antes, sem ela) e o
 * `down` grava as listas de volta.
 *
 * Só mexe em linhas (nada de DDL), então roda dentro da transação do teste
 * também no MySQL/MariaDB.
 */
class PermissionsMigrationTest extends AbstractChatTestCase
{
    private const PERMISSIONS = ['canela.chat.use', 'canela.chat.directMessage', 'canela.chat.createChannel', 'canela.chat.moderate'];

    private const SETTINGS = ['canela.chat_allowed_groups', 'canela.chat_dm_groups', 'canela.chat_create_channel_groups', 'canela.chat_moderator_groups'];

    /** @return array{up: callable, down: callable} */
    private function migration(): array
    {
        return require __DIR__.'/../../../../migrations/2026_10_27_100000_chat_permissions_from_settings.php';
    }

    private function migrate(string $direction): void
    {
        $this->migration()[$direction]($this->database()->getSchemaBuilder());
        $this->app()->getContainer()->make(\Flarum\Group\PermissionCache::class)->flush();
    }

    /** @return array<string, int[]> permissão => grupos */
    private function granted(): array
    {
        $out = array_fill_keys(self::PERMISSIONS, []);

        foreach ($this->database()->table('group_permission')->whereIn('permission', self::PERMISSIONS)->orderBy('group_id')->get() as $row) {
            $out[$row->permission][] = (int) $row->group_id;
        }

        return $out;
    }

    private function setRaw(string $key, string $value): void
    {
        $this->database()->table('settings')->updateOrInsert(['key' => $key], ['value' => $value]);
    }

    /** Um fórum que já usa o chat, antes da migration: as listas nas configurações, nenhuma permissão. */
    private function legacyForum(): void
    {
        $this->database()->table('group_permission')->whereIn('permission', self::PERMISSIONS)->delete();
    }

    /**
     * As listas viram permissões, grupo a grupo; a lista vazia não dá a
     * permissão a ninguém (só os administradores podem, como antes); o grupo
     * que não existe mais fica de fora; a configuração some.
     */
    #[Test]
    public function semeia_as_permissoes_a_partir_das_configuracoes(): void
    {
        $this->legacyForum();
        $this->setRaw('canela.chat_allowed_groups', '4');
        $this->setRaw('canela.chat_dm_groups', '');
        $this->setRaw('canela.chat_create_channel_groups', '3, 999');
        $this->setRaw('canela.chat_moderator_groups', '3,4');

        $this->migrate('up');

        $this->assertSame([
            'canela.chat.use' => [4],
            'canela.chat.directMessage' => [],
            'canela.chat.createChannel' => [3],
            'canela.chat.moderate' => [3, 4],
        ], $this->granted());

        $this->assertSame(0, $this->database()->table('settings')->whereIn('key', self::SETTINGS)->count());
    }

    /**
     * Quem podia o quê continua podendo, e quem não podia continua de fora:
     * com o chat restrito ao grupo 4, o membro comum recebe 403; com as MDs
     * sem grupo nenhum, nem o moderador abre MD — só o administrador.
     */
    #[Test]
    public function quem_podia_continua_podendo(): void
    {
        $this->legacyForum();
        $this->setRaw('canela.chat_allowed_groups', '4');
        $this->setRaw('canela.chat_dm_groups', '');

        $this->migrate('up');

        [$member] = $this->api('GET', '/chat-channels', 2);
        [$moderator] = $this->api('GET', '/chat-channels', 3);
        [$moderatorDm] = $this->api('POST', '/chat-channels/direct', 3, ['userIds' => [1]]);
        [$adminDm] = $this->api('POST', '/chat-channels/direct', 1, ['userIds' => [3]]);

        $this->assertEquals(403, $member);
        $this->assertEquals(200, $moderator);
        $this->assertEquals(422, $moderatorDm);
        $this->assertEquals(200, $adminDm);
    }

    /**
     * Sem as configurações gravadas (o chat nunca mexido no admin), vale o
     * padrão de antes: usar e MD para os membros, moderar para os
     * moderadores, criar canal só para os administradores.
     */
    #[Test]
    public function sem_configuracao_semeia_o_padrao(): void
    {
        $this->legacyForum();
        $this->database()->table('settings')->whereIn('key', self::SETTINGS)->delete();

        $this->migrate('up');

        $this->assertSame([
            'canela.chat.use' => [3],
            'canela.chat.directMessage' => [3],
            'canela.chat.createChannel' => [],
            'canela.chat.moderate' => [4],
        ], $this->granted());
    }

    /** Rodar de novo não duplica nada (a permissão já dada fica como está). */
    #[Test]
    public function rodar_duas_vezes_nao_duplica(): void
    {
        $this->legacyForum();
        $this->setRaw('canela.chat_allowed_groups', '3');

        $this->migrate('up');
        $this->setRaw('canela.chat_allowed_groups', '3,4');
        $this->migrate('up');

        $this->assertSame([3, 4], $this->granted()['canela.chat.use']);
    }

    /** O `down` grava de volta as listas (sem o Administrador) e tira as permissões. */
    #[Test]
    public function down_devolve_as_listas(): void
    {
        $this->legacyForum();
        $this->setRaw('canela.chat_allowed_groups', '3,4');
        $this->setRaw('canela.chat_dm_groups', '');
        $this->setRaw('canela.chat_create_channel_groups', '1,4');
        $this->setRaw('canela.chat_moderator_groups', '4');

        $this->migrate('up');
        $this->migrate('down');

        $settings = $this->database()->table('settings')->whereIn('key', self::SETTINGS)->pluck('value', 'key')->all();
        ksort($settings);

        $this->assertSame([
            'canela.chat_allowed_groups' => '3,4',
            'canela.chat_create_channel_groups' => '4',
            'canela.chat_dm_groups' => '',
            'canela.chat_moderator_groups' => '4',
        ], $settings);
        $this->assertSame(array_fill_keys(self::PERMISSIONS, []), $this->granted());
    }
}
