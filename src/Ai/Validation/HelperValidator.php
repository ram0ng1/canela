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
use Illuminate\Validation\Rule;
use Ramon\Canela\Ai\Helper\HelperController;
use Ramon\Canela\Ai\Helper\HelperPrompts;

/**
 * O pedido ao ajudante do editor (`POST /api/canela/ai/helper`): um modo
 * conhecido, o texto (aparado, até 20 000 caracteres) e, no modo de prompt
 * personalizado, o próprio prompt. Os opcionais (idioma, contexto, título) são
 * cortados no controller, como antes: passar do tamanho não é erro.
 */
final class HelperValidator extends AbstractValidator
{
    protected bool $validateMissingKeys = true;

    #[\Override]
    protected function getRules(): array
    {
        return [
            'mode' => ['required', 'string', Rule::in([...HelperPrompts::TEXT_MODES, ...HelperPrompts::SUGGESTION_MODES])],
            'text' => ['required', 'string', 'max:'.HelperController::MAX_TEXT],
            'customPrompt' => ['nullable', 'string', 'required_if:mode,custom_prompt'],
            'language' => ['nullable', 'string'],
            'context' => ['nullable', 'string'],
            'title' => ['nullable', 'string'],
        ];
    }

    #[\Override]
    protected function getMessages(): array
    {
        $mode = $this->translator->trans('ramon-canela.api.ai.errors.invalid_mode');
        $text = $this->translator->trans('ramon-canela.api.ai.errors.no_content');
        $prompt = $this->translator->trans('ramon-canela.api.ai.errors.no_prompt');

        return [
            'mode.required' => $mode,
            'mode.string' => $mode,
            'mode.in' => $mode,
            'text.required' => $text,
            'text.string' => $text,
            'text.max' => $text,
            'customPrompt.required_if' => $prompt,
        ];
    }
}
