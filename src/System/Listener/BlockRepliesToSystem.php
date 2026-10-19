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

namespace Ramon\Canela\System\Listener;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Messages\DialogMessage\Event\Creating;
use Ramon\Canela\System\SystemUser;

/**
 * A conversa com o usuário do sistema é só de ida: ninguém lê a caixa dele,
 * então uma resposta seria uma mensagem perdida. A API recusa com um aviso
 * (o fórum já esconde o campo de resposta nessa conversa).
 */
final class BlockRepliesToSystem
{
    public function __construct(
        private readonly SystemUser $system,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function handle(Creating $event): void
    {
        $message = $event->message;
        $systemId = $this->system->id();

        if (! $systemId || (int) $message->user_id === $systemId || ! $message->dialog_id) {
            return;
        }

        if ($message->dialog?->users()->where('users.id', $systemId)->exists()) {
            throw new ValidationException([
                'content' => $this->translator->trans('ramon-canela.forum.system_user.no_replies'),
            ]);
        }
    }
}
