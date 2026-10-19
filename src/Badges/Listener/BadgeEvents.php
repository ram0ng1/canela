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

namespace Ramon\Canela\Badges\Listener;

use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Badges\Scope;
use Ramon\Canela\Badges\TrustLevel\Promotion;
use Throwable;

/**
 * O que todo ouvinte dos emblemas faz: conceder os emblemas de um gatilho e
 * revisar o nível de quem agiu.
 *
 * Tudo dentro de try/catch: um emblema é um extra, e nenhuma falha dele pode
 * impedir alguém de postar, curtir ou ler.
 */
final class BadgeEvents
{
    /**
     * A revisão de nível por leitura vem de um evento que dispara a cada
     * trecho lido; uma por pessoa a cada 10 minutos basta.
     */
    private const READ_REVIEW_THROTTLE_SECONDS = 600;

    public function __construct(
        private readonly BadgeGranter $granter,
        private readonly Promotion $promotion,
        private readonly Capabilities $capabilities,
        private readonly Cache $cache,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function grant(string $trigger, Scope $scope): void
    {
        if ($this->ready()) {
            $this->safely(fn () => $this->granter->trigger($trigger, $scope));
        }
    }

    /**
     * Quem já foi revisado há pouco (id => quando): uma resposta revisa o
     * autor duas vezes (o post e a leitura que vem junto), e cada revisão são
     * sete consultas. Por tempo, e não "uma vez por processo": a fila roda
     * num processo só por horas.
     *
     * @var array<int, int>
     */
    private array $reviewed = [];

    private const REVIEW_MEMO_SECONDS = 10;

    /** @param iterable<User|null> $users */
    public function review(iterable $users): void
    {
        if (! $this->ready()) {
            return;
        }

        $now = time();

        foreach ($users as $user) {
            if (! $user || ! $user->exists || $user->isGuest()) {
                continue;
            }

            $id = (int) $user->id;

            if (isset($this->reviewed[$id]) && $now - $this->reviewed[$id] < self::REVIEW_MEMO_SECONDS) {
                continue;
            }

            $this->reviewed[$id] = $now;
            $this->safely(fn () => $this->promotion->review($user));
        }
    }

    /** Revisão de nível na leitura, no máximo uma a cada tantos minutos; o usuário só é carregado quando sai. */
    public function reviewThrottled(User|int $user): void
    {
        $id = $user instanceof User ? (int) $user->id : $user;

        if ($this->cache->add("canela.trust_level_review.{$id}", 1, self::READ_REVIEW_THROTTLE_SECONDS)) {
            $this->review([$user instanceof User ? $user : User::query()->find($id)]);
        }
    }

    private function ready(): bool
    {
        try {
            return $this->capabilities->installed();
        } catch (Throwable) {
            return false;
        }
    }

    private function safely(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $error) {
            $this->logger->error('[canela] emblemas: '.$error->getMessage(), ['exception' => $error]);
        }
    }
}
