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

namespace Ramon\Canela\RamonChat\Notification;

/**
 * "Fulano escreveu em #canal": para quem acompanha o canal ("Para todas as
 * atividades", nível 2) ou o fio. Um aviso não lido por canal basta — os
 * seguintes esperam o leitor abrir a conversa (ver NotifyChatActivity).
 */
final class ChatMessageBlueprint extends ChatActivityBlueprint
{
    public const TYPE = 'canelaRamonChatMessage';

    #[\Override]
    public static function getType(): string
    {
        return self::TYPE;
    }
}
