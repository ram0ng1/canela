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

use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Support\SchemaCache;

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

    /** O tamanho do título do Discourse (`max_topic_title_length`). */
    public const TITLE_MAX = 255;

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

    private static function hasColumn(ConnectionInterface $db, string $table, string $column): bool
    {
        $key = $table.'.'.$column;

        if (! isset(self::$columns[$key])) {
            // Pelo cache do esquema: sem ir ao information_schema a cada requisição.
            self::$columns[$key] = resolve(SchemaCache::class)->hasColumn($table, $column);
        }

        return self::$columns[$key];
    }
}
