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

namespace Ramon\Canela\Ai\Validation;

use Flarum\Foundation\AbstractValidator;
use Ramon\Canela\Ai\Http\Conversations\ReplyController;

/**
 * A pergunta ao bot (`POST /api/canela/ai/conversations/reply`): o texto já
 * aparado, entre 2 e 10 000 caracteres; a conversa (vazia = nova) e a persona
 * da conversa nova.
 *
 * Fica fora de um recurso porque a resposta vem em streaming: o pedido é
 * conferido aqui, antes dos cabeçalhos, enquanto um erro ainda vira 422.
 */
final class ReplyValidator extends AbstractValidator
{
    protected bool $validateMissingKeys = true;

    protected array $rules = [
        'message' => ['required', 'string', 'min:'.ReplyController::MIN_LENGTH, 'max:'.ReplyController::MAX_LENGTH],
        'conversationId' => ['nullable', 'integer', 'min:0'],
        'persona' => ['nullable', 'string', 'max:100'],
    ];

    #[\Override]
    protected function getMessages(): array
    {
        $length = $this->translator->trans('ramon-canela.api.ai.errors.message_length', ['min' => ReplyController::MIN_LENGTH, 'max' => ReplyController::MAX_LENGTH]);

        return [
            'message.required' => $length,
            'message.string' => $length,
            'message.min' => $length,
            'message.max' => $length,
        ];
    }
}
