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
 *
 * O mesmo vale para os emblemas de concessão múltipla sem postagem
 * (Aniversário, Novato do mês): o `post_id` é sempre NULL, o índice não
 * barra nada, e duas cargas ao mesmo tempo (o agendador e o "Conceder agora")
 * davam o mesmo aniversário duas vezes. Ali a conferência é pela data da
 * concessão, que a regra calcula sempre igual para o mesmo aniversário.
 *
 * E a carga inteira (`backfill`) tem uma trava global própria: duas cargas
 * não rodam juntas — a segunda desiste, porque a primeira já concede tudo.
 */
final class SingleGrantLock
{
    /** Validade da trava: o bastante para a transação mais longa que grava um emblema. */
    private const LOCK_SECONDS = 10;

    /** Validade da trava da carga inteira: a carga mais longa de um fórum grande. */
    private const BACKFILL_LOCK_SECONDS = 3600;

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
        return $this->guarded($userBadge, static fn () => UserBadge::query()
            ->where('badge_id', $userBadge->badge_id)
            ->where('user_id', $userBadge->user_id));
    }

    /**
     * Emblema de concessão múltipla sem postagem: grava se a pessoa ainda não
     * tem uma concessão dele com a mesma data (o mesmo aniversário, o mesmo
     * mês); diz se gravou.
     */
    public function saveRepeat(UserBadge $userBadge): bool
    {
        return $this->guarded($userBadge, static fn () => UserBadge::query()
            ->where('badge_id', $userBadge->badge_id)
            ->where('user_id', $userBadge->user_id)
            ->whereNull('post_id')
            ->where('granted_at', $userBadge->granted_at));
    }

    /**
     * Roda a carga inteira só se nenhuma outra estiver rodando. Devolve o que
     * `$callback` devolveu, ou null se outra carga já estava em andamento.
     *
     * @template T
     * @param callable(): T $callback
     * @return T|null
     */
    public function exclusiveBackfill(callable $callback): mixed
    {
        $store = $this->cache->getStore();

        if (! $store instanceof LockProvider) {
            return $callback();
        }

        $lock = $store->lock('canela.badge-backfill', self::BACKFILL_LOCK_SECONDS);

        if (! $lock->get()) {
            return null;
        }

        try {
            return $callback();
        } finally {
            $lock->release();
        }
    }

    /**
     * Confere (com `$existing`) e grava atrás da trava de (emblema, pessoa).
     *
     * @param callable(): \Illuminate\Database\Eloquent\Builder<UserBadge> $existing
     */
    private function guarded(UserBadge $userBadge, callable $existing): bool
    {
        $store = $this->cache->getStore();

        if (! $store instanceof LockProvider) {
            return $this->saveIfMissing($userBadge, $existing);
        }

        $lock = $store->lock("canela.badge-grant.{$userBadge->badge_id}.{$userBadge->user_id}", self::LOCK_SECONDS);

        try {
            $lock->block($this->waitSeconds);
        } catch (LockTimeoutException) {
            return false;
        }

        try {
            $saved = $this->saveIfMissing($userBadge, $existing);
        } catch (\Throwable $error) {
            $lock->release();

            throw $error;
        }

        $this->releaseAfterTransaction($userBadge, $lock);

        return $saved;
    }

    /** @param callable(): \Illuminate\Database\Eloquent\Builder<UserBadge> $existing */
    private function saveIfMissing(UserBadge $userBadge, callable $existing): bool
    {
        if ($existing()->sharedLock()->exists()) {
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
