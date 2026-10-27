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

namespace Ramon\Canela\MeToo\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Ramon\Canela\MeToo\Access\MeTooPolicy;
use Ramon\Canela\MeToo\MeToo;
use Ramon\Canela\Support\Log;

/**
 * `canelaMeToo` no tópico: `{count, mine, can}`, ou null quando o botão não
 * aparece. Só na página do tópico (`showing`): na lista seria uma consulta
 * por linha para algo que ela não
 * mostra. Uma falha vira null: o botão some, o tópico abre normalmente.
 */
final class DiscussionMeTooFields
{
    public function __construct(
        private readonly MeToo $meToo
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaMeToo')
                ->nullable()
                ->visible(fn (Discussion $discussion, Context $context): bool => $this->meToo->enabled() && $context->showing(DiscussionResource::class))
                ->get(function (Discussion $discussion, Context $context): ?array {
                    try {
                        if (! $this->meToo->visibleOn($discussion)) {
                            return null;
                        }

                        $actor = $context->getActor();

                        return [...$this->meToo->stateFor($discussion, $actor), 'can' => $actor->can(MeTooPolicy::ABILITY, $discussion)];
                    } catch (\Throwable $error) {
                        Log::warning('me too do tópico: '.$error->getMessage());

                        return null;
                    }
                }),
        ];
    }
}
