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

namespace Ramon\Canela\Chat;

use Ramon\Canela\Chat\Model\Membership;

/**
 * O que o ChatAccess já sabe de um ator nesta requisição. Preso ao objeto do
 * ator (WeakMap): some com ele, e a próxima requisição começa do zero.
 *
 * @internal
 */
final class ActorCache
{
    /** Se `$tags` já foi calculado (null também é resposta: sem o flarum/tags). */
    public bool $tagsLoaded = false;

    /** @var int[]|null as tags que o ator enxerga */
    public ?array $tags = null;

    /** @var array<int, Membership|null> canal => participação do ator, já carregada */
    public array $memberships = [];
}
