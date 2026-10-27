<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration;

/**
 * O ramon/chat 0.3.4 não instala no MySQL e no MariaDB com um prefixo de
 * tabela de 9 caracteres ou mais: o nome automático do índice único de
 * `chat_channel_rank_user` (prefixo + tabela + colunas) passa do limite de 64
 * do banco. A correção é no ramon/chat (um nome curto e explícito no índice);
 * até lá, o setup não liga a extensão nesse banco, e os testes da integração
 * com ela ficam de fora só nele — nos outros (SQLite, PostgreSQL, MySQL sem
 * prefixo) eles rodam.
 */
final class RamonChatSchema
{
    private const INDEX = 'chat_channel_rank_user_channel_id_user_id_rank_id_unique';

    private const MYSQL_IDENTIFIER_LIMIT = 64;

    /** Por que o ramon/chat não instala neste banco de testes, ou null se instala. */
    public static function unsupportedReason(): ?string
    {
        $driver = getenv('DB_DRIVER') ?: 'sqlite';
        $prefix = getenv('DB_PREFIX') ?: '';

        if (! in_array($driver, ['mysql', 'mariadb'], true) || strlen($prefix.self::INDEX) <= self::MYSQL_IDENTIFIER_LIMIT) {
            return null;
        }

        return "ramon/chat: o índice `{$prefix}".self::INDEX.'` passa de 64 caracteres no '.$driver.' (corrigir no ramon/chat).';
    }
}
