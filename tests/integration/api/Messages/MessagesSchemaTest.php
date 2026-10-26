<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Messages;

use Flarum\Extension\Event\Disabled;
use Flarum\Extension\Event\Enabled;
use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Testing\integration\TestCase;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * O esquema do tema nas tabelas do flarum/messages não depende da ordem em
 * que as extensões foram ligadas: com o tema ligado antes, as migrations
 * `*_messages_*` rodam sem as tabelas dele e ficam registradas como rodadas;
 * o MessagesSchemaProvider instala o que falta quando o flarum/messages é
 * habilitado e, como rede, na primeira requisição sem a marca.
 *
 * (Cada teste roda numa transação; no SQLite, o DDL também volta atrás.)
 */
class MessagesSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-messages', 'ramon-canela');
    }

    private function dropSomeSchema(): void
    {
        $schema = $this->database()->getSchemaBuilder();
        $schema->dropIfExists(MessagesSchema::EVENTS_TABLE);
        $schema->table(MessagesSchema::DIALOG_TABLE, static function (Blueprint $table): void {
            $table->dropColumn(MessagesSchema::TITLE_COLUMN);
        });

        $this->database()->table('settings')->where('key', MessagesSchema::MARKER)->delete();
        $this->app()->getContainer()->make(SettingsRepositoryInterface::class)->delete(MessagesSchema::MARKER);
    }

    private function assertSchemaInstalled(): void
    {
        $schema = $this->database()->getSchemaBuilder();

        $this->assertTrue($schema->hasTable(MessagesSchema::EVENTS_TABLE));
        $this->assertTrue($schema->hasTable(MessagesSchema::REACTIONS_TABLE));
        $this->assertTrue($schema->hasColumn(MessagesSchema::DIALOG_TABLE, MessagesSchema::TITLE_COLUMN));
        $this->assertTrue($schema->hasColumn(MessagesSchema::DIALOG_TABLE, MessagesSchema::GROUP_COLUMN));
        $this->assertTrue($schema->hasColumn(MessagesSchema::STATE_TABLE, MessagesSchema::ARCHIVED_COLUMN));
        $this->assertTrue($schema->hasColumn(MessagesSchema::STATE_TABLE, MessagesSchema::LEVEL_COLUMN));
        $this->assertSame(MessagesSchema::VERSION, $this->database()->table('settings')->where('key', MessagesSchema::MARKER)->value('value'));
    }

    /**
     * Sem a marca, a primeira requisição com o flarum/messages ligado
     * confere e instala o esquema, e grava a marca.
     */
    #[Test]
    public function sem_a_marca_o_esquema_e_conferido_ao_subir(): void
    {
        $this->setting(MessagesSchema::MARKER, '');

        $this->app();

        $this->assertSchemaInstalled();
    }

    /**
     * Habilitar o flarum/messages instala o que falta, mesmo com a marca.
     */
    #[Test]
    public function habilitar_o_flarum_messages_instala_o_que_falta(): void
    {
        $this->dropSomeSchema();
        $this->database()->table('settings')->insert(['key' => MessagesSchema::MARKER, 'value' => MessagesSchema::VERSION]);

        $container = $this->app()->getContainer();
        $extension = $container->make(ExtensionManager::class)->getExtension('flarum-messages');
        $container->make(Dispatcher::class)->dispatch(new Enabled($extension));

        $this->assertSchemaInstalled();
    }

    /**
     * Desabilitar o flarum/messages tira a marca; o próximo ensure() confere
     * e cria de novo o que falta.
     */
    #[Test]
    public function desabilitar_tira_a_marca_e_ensure_reinstala(): void
    {
        $container = $this->app()->getContainer();
        $extension = $container->make(ExtensionManager::class)->getExtension('flarum-messages');
        $container->make(Dispatcher::class)->dispatch(new Disabled($extension));

        $this->assertNull($this->database()->table('settings')->where('key', MessagesSchema::MARKER)->value('value'));

        $this->dropSomeSchema();

        $settings = $container->make(SettingsRepositoryInterface::class);
        $this->assertTrue(MessagesSchema::ensure($this->database(), $settings));

        $this->assertSchemaInstalled();
    }

    /**
     * Sem as tabelas do flarum/messages, instalar não faz nada (e diz isso).
     */
    #[Test]
    public function sem_o_flarum_messages_nada_e_criado(): void
    {
        $schema = $this->database()->getSchemaBuilder();
        $schema->disableForeignKeyConstraints();
        $schema->drop(MessagesSchema::REACTIONS_TABLE);
        $schema->drop(MessagesSchema::EVENTS_TABLE);
        $schema->drop('dialog_user');

        $this->assertFalse(MessagesSchema::install($schema));
        $this->assertFalse($schema->hasTable(MessagesSchema::EVENTS_TABLE));
    }
}
