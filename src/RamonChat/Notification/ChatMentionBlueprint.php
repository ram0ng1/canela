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

use Ramon\Chat\Message;

/** "Fulano mencionou você em #canal" (ou usou @here / @all). */
final class ChatMentionBlueprint extends ChatActivityBlueprint
{
    public const TYPE = 'canelaRamonChatMention';

    /** @param 'user'|'here'|'all' $kind */
    public function __construct(
        Message $message,
        public readonly string $kind = 'user',
    ) {
        parent::__construct($message);
    }

    /** @return array<string, mixed> */
    #[\Override]
    public function getData(): array
    {
        return [...parent::getData(), 'kind' => $this->kind];
    }

    #[\Override]
    public static function getType(): string
    {
        return self::TYPE;
    }
}
