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

use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Grava a concessão de um emblema de concessão única só se a pessoa ainda não
 * o tem — também com duas requisições ao mesmo tempo.
 *
 * O índice único `(badge_id, user_id, post_id)` não segura esse caso: o
 * `post_id` muda de uma concessão para outra (o post que disparou) ou é NULL,
 * e o MySQL aceita vários NULL num índice único. Duas curtidas simultâneas na
 * mesma pessoa davam o "Bem-vindo" duas vezes.
 *
 * Aqui a conferência e a gravação ficam atrás de uma trava do cache por
 * (emblema, pessoa). Dentro de uma transação, a trava só sai depois do commit
 * (ou do rollback): antes disso o outro processo não enxergaria a linha nova.
 * A conferência usa leitura com trava (`LOCK IN SHARE MODE`), que lê o último
 * dado gravado mesmo numa transação que já tirou o retrato do banco.
 */
final class SingleGrantLock
{
    /** Validade da trava: o bastante para a transação mais longa que grava um emblema. */
    private const LOCK_SECONDS = 10;

    public function __construct(
        private readonly Cache $cache,
        // Quanto esperar a trava de outro processo. Passado isso, ele está
        // concedendo o mesmo emblema à mesma pessoa: este desiste.
        private readonly int $waitSeconds = 3,
    ) {
    }

    /** Grava se a pessoa ainda não tem o emblema; diz se gravou. */
    public function save(UserBadge $userBadge): bool
    {
        $store = $this->cache->getStore();

        if (! $store instanceof LockProvider) {
            return $this->saveIfMissing($userBadge);
        }

        $lock = $store->lock("canela.badge-grant.{$userBadge->badge_id}.{$userBadge->user_id}", self::LOCK_SECONDS);

        try {
            $lock->block($this->waitSeconds);
        } catch (LockTimeoutException) {
            return false;
        }

        try {
            $saved = $this->saveIfMissing($userBadge);
        } catch (\Throwable $error) {
            $lock->release();

            throw $error;
        }

        $this->releaseAfterTransaction($userBadge, $lock);

        return $saved;
    }

    private function saveIfMissing(UserBadge $userBadge): bool
    {
        $exists = UserBadge::query()
            ->where('badge_id', $userBadge->badge_id)
            ->where('user_id', $userBadge->user_id)
            ->sharedLock()
            ->exists();

        if ($exists) {
            return false;
        }

        $userBadge->save();

        return true;
    }

    private function releaseAfterTransaction(UserBadge $userBadge, Lock $lock): void
    {
        $connection = $userBadge->getConnection();

        if ($connection->transactionLevel() === 0) {
            $lock->release();

            return;
        }

        // Sem o gerenciador de transações o `afterCommit` lança erro: aí a
        // trava sai já (e, no pior caso, expira sozinha em LOCK_SECONDS).
        try {
            $connection->afterCommit(static fn () => $lock->release());
            $connection->afterRollBack(static fn () => $lock->release());
        } catch (\RuntimeException) {
            $lock->release();
        }
    }
}
