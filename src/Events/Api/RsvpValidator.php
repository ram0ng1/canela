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

namespace Ramon\Canela\Events\Api;

use Flarum\Foundation\AbstractValidator;
use Illuminate\Validation\Rule;
use Ramon\Canela\Events\EventInvitee;

/**
 * A resposta à presença (`POST /api/canela-events/{id}/rsvp`): `status` é
 * vou, interessado ou não vou; null (ou ausente) tira a resposta.
 */
final class RsvpValidator extends AbstractValidator
{
    #[\Override]
    protected function getRules(): array
    {
        return [
            'status' => ['nullable', Rule::in(EventInvitee::STATUSES)],
        ];
    }

    #[\Override]
    protected function getMessages(): array
    {
        return [
            'status.in' => $this->translator->trans('ramon-canela.api.events.invalid_status'),
        ];
    }
}
