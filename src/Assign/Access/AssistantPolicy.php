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

namespace Ramon\Canela\Assign\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Assign\AssistantBot;

/**
 * Curtir, renomear e mudar tags valem para o assistente quando a opção está
 * ligada no admin, sem ele precisar ser administrador. Vale para o tópico
 * (`likePosts`, `rename`, `tag`) e para a tag nova (`addToDiscussion`).
 *
 * `forceAllow`, e não uma permissão no grupo dele: em tag restrita o
 * flarum/tags nega tudo que não tem a permissão da tag (`tag5.discussion.tag`,
 * `tag5.addToDiscussion`), e o admin teria de marcar o grupo oculto do
 * assistente tag por tag.
 */
final class AssistantPolicy extends AbstractPolicy
{
    private const ABILITIES = ['likePosts' => 'like', 'rename' => 'rename', 'tag' => 'retag', 'addToDiscussion' => 'retag'];

    public function __construct(
        private readonly AssistantBot $bot,
    ) {
    }

    public function can(User $actor, string $ability, object $model): ?string
    {
        $action = self::ABILITIES[$ability] ?? null;

        return $action !== null && $this->bot->is($actor) && $this->bot->can($action) ? $this->forceAllow() : null;
    }
}
