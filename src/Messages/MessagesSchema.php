<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Messages;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;
use Ramon\Canela\Support\SchemaCache;
use Throwable;

/**
 * As colunas que o tema acrescenta às tabelas do flarum/messages
 * (`dialog_user.canela_archived_at`, `dialogs.canela_title`,
 * `dialogs.canela_view_count`).
 *
 * As migrations do tema podem ainda não ter rodado, ou o flarum/messages pode
 * ter sido instalado depois delas: cada leitura e cada escrita pergunta antes
 * se a coluna existe. Sem ela o recurso some (não há arquivo, não há título),
 * mas enviar e ler mensagens continua funcionando — gravar numa coluna que não
 * existe derrubaria o envio com erro 500.
 *
 * A criação do esquema mora aqui (install()), idempotente: as migrations
 * `*_messages_*` a chamam, mas, se o tema foi ligado antes do flarum/messages,
 * elas rodaram sem as tabelas dele, não fizeram nada e ficaram registradas
 * como rodadas — nunca mais rodariam. Por isso o esquema também é instalado
 * quando o flarum/messages é habilitado (o evento `Enabled`) e, como rede, na
 * primeira requisição com ele ligado e sem a marca `canela.messages_schema`
 * (MessagesSchemaProvider). A marca diz que está tudo criado: com ela, as
 * perguntas abaixo nem vão ao esquema.
 */
final class MessagesSchema
{
    public const STATE_TABLE = 'dialog_user';

    public const DIALOG_TABLE = 'dialogs';

    public const ARCHIVED_COLUMN = 'canela_archived_at';

    public const TITLE_COLUMN = 'canela_title';

    public const VIEWS_COLUMN = 'canela_view_count';

    public const GROUP_COLUMN = 'canela_group_id';

    public const VIA_GROUP_COLUMN = 'canela_via_group';

    public const LEVEL_COLUMN = 'canela_notification_level';

    /** O tipo das conversas que deixam de ser a dois (grupo ou convidados). */
    public const GROUP_TYPE = 'canela_group';

    /** O tamanho máximo do título. */
    public const TITLE_MAX = 255;

    public const EVENTS_TABLE = 'canela_dialog_events';

    public const REACTIONS_TABLE = 'canela_dialog_message_reactions';

    /** A marca de "esquema instalado", nas configurações. */
    public const MARKER = 'canela.messages_schema';

    /** A versão do esquema: suba ao acrescentar uma coluna ou tabela em install(). */
    public const VERSION = '1';

    /** @var array<string, bool> */
    private static array $columns = [];

    public static function hasArchive(ConnectionInterface $db): bool
    {
        return self::hasColumn($db, self::STATE_TABLE, self::ARCHIVED_COLUMN);
    }

    public static function hasTitle(ConnectionInterface $db): bool
    {
        return self::hasColumn($db, self::DIALOG_TABLE, self::TITLE_COLUMN);
    }

    public static function hasViews(ConnectionInterface $db): bool
    {
        return self::hasColumn($db, self::DIALOG_TABLE, self::VIEWS_COLUMN);
    }

    /** Mensagens de grupo, convites e níveis de notificação (migration 400300). */
    public static function hasGroups(ConnectionInterface $db): bool
    {
        return self::hasColumn($db, self::DIALOG_TABLE, self::GROUP_COLUMN)
            && self::hasColumn($db, self::STATE_TABLE, self::VIA_GROUP_COLUMN)
            && self::hasColumn($db, self::STATE_TABLE, self::LEVEL_COLUMN);
    }

    /** A tabela dos acontecimentos ("Convidou @fulano"; migration 400400). */
    public static function hasEvents(): bool
    {
        return self::installed() || resolve(SchemaCache::class)->hasTable(self::EVENTS_TABLE);
    }

    /** A tabela das reações nas mensagens (migration 400500). */
    public static function hasReactions(): bool
    {
        return self::installed() || resolve(SchemaCache::class)->hasTable(self::REACTIONS_TABLE);
    }

    /** A marca está na versão atual: tudo o que install() cria existe. */
    public static function installed(): bool
    {
        try {
            return resolve(SettingsRepositoryInterface::class)->get(self::MARKER) === self::VERSION;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Instala o esquema, se faltar, e grava a marca. Sem `$force`, a marca
     * na versão atual basta (uma leitura das configurações, já em memória).
     *
     * @return bool se o esquema está pronto (falso: o flarum/messages ainda
     *              não criou as tabelas dele)
     */
    public static function ensure(ConnectionInterface $db, SettingsRepositoryInterface $settings, bool $force = false): bool
    {
        if (! $force && $settings->get(self::MARKER) === self::VERSION) {
            return true;
        }

        if (! $db instanceof Connection || ! self::install($db->getSchemaBuilder())) {
            return false;
        }

        $settings->set(self::MARKER, self::VERSION);
        self::$columns = [];

        return true;
    }

    /** Tira a marca: o esquema é conferido (e instalado) de novo na próxima vez. */
    public static function forget(ConnectionInterface $db): void
    {
        $db->table('settings')->where('key', self::MARKER)->delete();
        self::$columns = [];
    }

    /**
     * Cria o que falta das colunas e tabelas do tema nas do flarum/messages.
     * Pode rodar quantas vezes for: cada parte confere antes se já existe.
     *
     * @return bool falso sem as tabelas do flarum/messages (nada a fazer ainda)
     */
    public static function install(Builder $schema): bool
    {
        if (! $schema->hasTable(self::DIALOG_TABLE) || ! $schema->hasTable(self::STATE_TABLE) || ! $schema->hasTable('dialog_messages')) {
            return false;
        }

        self::installArchive($schema);
        self::installTitle($schema);
        self::installViews($schema);
        self::installGroups($schema);
        self::installEvents($schema);
        self::installReactions($schema);

        return true;
    }

    /** O arquivo por pessoa (migration 400000). */
    public static function installArchive(Builder $schema): void
    {
        if (! $schema->hasTable(self::STATE_TABLE) || $schema->hasColumn(self::STATE_TABLE, self::ARCHIVED_COLUMN)) {
            return;
        }

        $schema->table(self::STATE_TABLE, static function (Blueprint $table): void {
            $table->dateTime(self::ARCHIVED_COLUMN)->nullable();
            $table->index(['user_id', self::ARCHIVED_COLUMN], 'dialog_user_canela_archived_index');
        });
    }

    /** O título da mensagem (migration 400100). */
    public static function installTitle(Builder $schema): void
    {
        if (! $schema->hasTable(self::DIALOG_TABLE) || $schema->hasColumn(self::DIALOG_TABLE, self::TITLE_COLUMN)) {
            return;
        }

        $schema->table(self::DIALOG_TABLE, static function (Blueprint $table): void {
            $table->string(self::TITLE_COLUMN, self::TITLE_MAX)->nullable();
        });
    }

    /** As visualizações (migration 400200). */
    public static function installViews(Builder $schema): void
    {
        if (! $schema->hasTable(self::DIALOG_TABLE) || $schema->hasColumn(self::DIALOG_TABLE, self::VIEWS_COLUMN)) {
            return;
        }

        $schema->table(self::DIALOG_TABLE, static function (Blueprint $table): void {
            $table->unsignedInteger(self::VIEWS_COLUMN)->default(0);
        });
    }

    /** Mensagens de grupo e níveis de notificação (migration 400300). */
    public static function installGroups(Builder $schema): void
    {
        if ($schema->hasTable(self::DIALOG_TABLE) && ! $schema->hasColumn(self::DIALOG_TABLE, self::GROUP_COLUMN)) {
            $schema->table(self::DIALOG_TABLE, static function (Blueprint $table): void {
                $table->unsignedInteger(self::GROUP_COLUMN)->nullable()->index();
            });
        }

        if ($schema->hasTable(self::STATE_TABLE) && ! $schema->hasColumn(self::STATE_TABLE, self::VIA_GROUP_COLUMN)) {
            $schema->table(self::STATE_TABLE, static function (Blueprint $table): void {
                $table->boolean(self::VIA_GROUP_COLUMN)->default(false);
            });
        }

        if ($schema->hasTable(self::STATE_TABLE) && ! $schema->hasColumn(self::STATE_TABLE, self::LEVEL_COLUMN)) {
            $schema->table(self::STATE_TABLE, static function (Blueprint $table): void {
                $table->unsignedTinyInteger(self::LEVEL_COLUMN)->nullable();
            });
        }
    }

    /** Os acontecimentos da conversa (migration 400400). */
    public static function installEvents(Builder $schema): void
    {
        if (! $schema->hasTable(self::DIALOG_TABLE) || $schema->hasTable(self::EVENTS_TABLE)) {
            return;
        }

        $schema->create(self::EVENTS_TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('dialog_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('type', 32);
            $table->unsignedInteger('target_user_id')->nullable();
            $table->unsignedInteger('target_group_id')->nullable();
            $table->dateTime('created_at');

            $table->index('dialog_id');
            $table->foreign('dialog_id')->references('id')->on(self::DIALOG_TABLE)->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('target_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    /** As reações nas mensagens (migration 400500). */
    public static function installReactions(Builder $schema): void
    {
        if (! $schema->hasTable('dialog_messages') || $schema->hasTable(self::REACTIONS_TABLE)) {
            return;
        }

        $schema->create(self::REACTIONS_TABLE, static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('message_id');
            $table->unsignedInteger('user_id');
            $table->string('reaction', 64);
            $table->dateTime('created_at');

            $table->unique(['message_id', 'user_id'], 'canela_dmr_message_user_unique');
            $table->foreign('message_id')->references('id')->on('dialog_messages')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    private static function hasColumn(ConnectionInterface $db, string $table, string $column): bool
    {
        if (self::installed()) {
            return true;
        }

        $key = $table.'.'.$column;

        if (! isset(self::$columns[$key])) {
            // Pelo cache do esquema: sem ir ao information_schema a cada requisição.
            self::$columns[$key] = resolve(SchemaCache::class)->hasColumn($table, $column);
        }

        return self::$columns[$key];
    }
}
