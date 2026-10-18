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

namespace Ramon\Canela\Badges;

/**
 * O recorte de uma consulta de emblema: o `:backfill OR id IN (:post_ids)` /
 * `(:user_ids)` das consultas do Discourse.
 *
 * Sem usuários nem postagens é a carga completa (todo o fórum). Com eles, a
 * consulta só olha o que o evento tocou — a curtida nova, o post editado.
 */
final class Scope
{
    /**
     * @param list<int>|null $userIds
     * @param list<int>|null $postIds
     */
    private function __construct(
        public readonly ?array $userIds,
        public readonly ?array $postIds,
    ) {
    }

    public static function backfill(): self
    {
        return new self(null, null);
    }

    /** @param list<int> $userIds */
    public static function users(array $userIds): self
    {
        return new self(array_values(array_unique(array_map('intval', $userIds))), null);
    }

    /** @param list<int> $postIds */
    public static function posts(array $postIds): self
    {
        return new self(null, array_values(array_unique(array_map('intval', $postIds))));
    }

    public function isBackfill(): bool
    {
        return $this->userIds === null && $this->postIds === null;
    }
}
