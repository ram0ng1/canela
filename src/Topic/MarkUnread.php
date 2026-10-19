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

namespace Ramon\Canela\Topic;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * "Marcar não lido" que vale também depois de "marcar tudo como lido".
 *
 * O core conta como lido todo tópico sem post novo desde `marked_all_as_read_at`,
 * seja qual for o estado de leitura. `discussion_user.canela_marked_unread_at`
 * guarda quando a pessoa marcou aquele tópico como não lido: mais nova que a
 * data de "marcar tudo", o tópico volta a contar como não lido (na lista, no
 * filtro "Não lidos" e nas contagens). Um "marcar tudo" depois disso vence de
 * novo, como esperado.
 */
final class MarkUnread
{
    public const COLUMN = 'canela_marked_unread_at';

    /** Gravada pela migração: a coluna existe (fórum que ainda não migrou segue sem ela). */
    public const SCHEMA = 'canela.marked_unread_schema';

    public static function ready(SettingsRepositoryInterface $settings): bool
    {
        return $settings->get(self::SCHEMA) === '1';
    }
}
