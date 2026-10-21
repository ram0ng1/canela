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

namespace Ramon\Canela\System\Messages;

/**
 * As mensagens automáticas. Cada uma tem a chave liga/desliga
 * `canela.sysmsg_<tipo>` e, opcionais, o assunto e o texto do admin em
 * `canela.sysmsg_<tipo>_subject` e `canela.sysmsg_<tipo>_body`; vazios, valem
 * os textos padrão das traduções (`ramon-canela.admin.sysmsg.<tipo>.*`), no
 * idioma de quem recebe.
 *
 * Os textos aceitam as variáveis no formato `%{nome}`.
 */
final class AutoMessages
{
    /** Boas-vindas a quem acabou de ativar a conta (`send_welcome_message`). */
    public const WELCOME_USER = 'welcome_user';

    /** Boas-vindas a quem entrou por um convite. */
    public const WELCOME_INVITE = 'welcome_invite';

    /** Promovido ao nível de confiança 1 (`send_tl1_welcome_message`). */
    public const WELCOME_TL1 = 'welcome_tl1_user';

    /** Promovido ao nível de confiança 2 (`send_tl2_promotion_message`). */
    public const TL2_PROMOTION = 'tl2_promotion_message';

    /** Entrou para a equipe (grupo Admin ou Moderadores). */
    public const WELCOME_STAFF = 'welcome_staff';

    /** Adicionado a um grupo comum. */
    public const ADDED_TO_GROUP = 'user_added_to_group_as_member';

    /** Um post denunciado foi ocultado ou apagado pela equipe. */
    public const FLAGS_AGREED = 'flags_agreed_and_post_deleted';

    /** A conta foi suspensa. */
    public const SUSPENDED = 'silenced_by_staff';

    /** A suspensão acabou. */
    public const UNSUSPENDED = 'unsilenced';

    /**
     * Os tipos na ordem do admin, com o padrão de cada chave liga/desliga e
     * se a mensagem sai uma vez só por pessoa (as de boas-vindas e de nível).
     *
     * @var array<string, array{default: bool, once: bool}>
     */
    public const TYPES = [
        self::WELCOME_USER => ['default' => true, 'once' => true],
        self::WELCOME_INVITE => ['default' => true, 'once' => true],
        self::WELCOME_TL1 => ['default' => true, 'once' => true],
        self::TL2_PROMOTION => ['default' => true, 'once' => true],
        self::WELCOME_STAFF => ['default' => true, 'once' => false],
        self::ADDED_TO_GROUP => ['default' => false, 'once' => false],
        self::FLAGS_AGREED => ['default' => true, 'once' => false],
        self::SUSPENDED => ['default' => true, 'once' => false],
        self::UNSUSPENDED => ['default' => true, 'once' => false],
    ];

    public static function setting(string $type, string $suffix = ''): string
    {
        return 'canela.sysmsg_'.$type.($suffix !== '' ? '_'.$suffix : '');
    }

    public static function translationKey(string $type, string $part): string
    {
        return 'ramon-canela.admin.sysmsg.'.$type.'.'.$part;
    }

    /**
     * Troca `%{nome}` e também `{nome}` pelos
     * valores; uma variável desconhecida fica como está, para o admin ver
     * que escreveu errado.
     *
     * @param array<string, string|int|null> $params
     */
    public static function interpolate(string $text, array $params): string
    {
        return (string) preg_replace_callback(
            '/%?\{([a-z_]+)\}/',
            static fn (array $match): string => array_key_exists($match[1], $params) ? (string) $params[$match[1]] : $match[0],
            $text
        );
    }
}
