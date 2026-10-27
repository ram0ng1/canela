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

namespace Ramon\Canela\Extras\History;

use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Extras\Extras;

/**
 * `$actor->can('canelaViewHistory', $post)`: abrir o histórico de edições
 * da postagem — o número ao lado do lápis e o modal "Histórico".
 *
 * A regra é a de Extras::canSeeHistory: recurso ligado e, com o histórico
 * fechado no admin, só o autor e quem pode editar a postagem. `forceDeny`
 * com o recurso desligado, para nem o administrador ver.
 */
final class PostHistoryPolicy extends AbstractPolicy
{
    public const ABILITY = 'canelaViewHistory';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function canelaViewHistory(User $actor, Post $post): string
    {
        return Extras::canSeeHistory($this->settings, $actor, $post) ? $this->allow() : $this->forceDeny();
    }
}
