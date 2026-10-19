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

use Carbon\Carbon;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Badges\Notification\BadgeGrantedBlueprint;
use Throwable;

/**
 * Concede os emblemas: roda a regra de cada um (BadgeQueries) no recorte
 * pedido, descarta o que a pessoa já tem e grava o resto, com a notificação.
 *
 * Um emblema que falha (uma tabela de outra extensão com formato inesperado,
 * por exemplo) é registrado no log e pulado: o post, a curtida ou a carga
 * diária que o disparou seguem normalmente.
 */
final class BadgeGranter
{
    /**
     * Concessões mais antigas que isto entram sem notificação. É o que separa
     * "acabou de ganhar" de "ganhou há meses e a regra só agora rodou" —
     * ligar um emblema antigo no admin não pode notificar o fórum inteiro.
     */
    private const NOTIFY_WINDOW_HOURS = 48;

    /** @var Collection<string, Badge>|null */
    private ?Collection $badges = null;

    public function __construct(
        private readonly BadgeQueries $queries,
        private readonly BadgeSettings $settings,
        private readonly NotificationSyncer $notifications,
        private readonly LoggerInterface $logger,
        private readonly Capabilities $capabilities,
        private readonly SingleGrantLock $singleGrant,
    ) {
    }

    /** Os emblemas de um gatilho, só no que o evento tocou. */
    public function trigger(string $trigger, Scope $scope): int
    {
        if (! $this->settings->badgesEnabled()) {
            return 0;
        }

        $granted = 0;

        foreach ($this->queries->slugsFor($trigger) as $slug) {
            $badge = $this->enabledBadges()->get($slug);

            if ($badge) {
                $granted += $this->run($badge, $scope, true);
            }
        }

        return $granted;
    }

    /**
     * Todos os emblemas, no fórum inteiro.
     *
     * @param bool $full também os que leem o conteúdo de cada postagem
     * @param (callable(Badge, int): void)|null $progress
     */
    public function backfill(bool $full = false, ?callable $progress = null): int
    {
        if (! $this->settings->badgesEnabled()) {
            return 0;
        }

        // A primeira carga é sempre completa, e calada (sem notificações): o
        // que ela concede é o histórico do fórum, não uma conquista de agora.
        // Os eventos (post, curtida…) notificam desde o começo.
        $notify = $this->settings->backfilled();
        $full = $full || ! $notify;
        $granted = 0;

        foreach ($this->enabledBadges() as $badge) {
            if (! $full && in_array($badge->slug, BadgeQueries::CONTENT_SCANS, true)) {
                continue;
            }

            $count = $this->run($badge, Scope::backfill(), $notify);
            $granted += $count;

            if ($progress) {
                $progress($badge, $count);
            }
        }

        if (! $notify) {
            $this->settings->markBackfilled();
        }

        return $granted;
    }

    /**
     * Concessão manual (o "Award badge" do Discourse). Quem chama já validou
     * se o emblema aceita concessão manual e se a pessoa já o tem; aqui só se
     * grava e notifica — sempre, porque foi um gesto da administração agora.
     */
    public function grantManually(Badge $badge, User $user, User $actor, ?string $reason): UserBadge
    {
        $userBadge = new UserBadge();
        $userBadge->user_id = $user->id;
        $userBadge->badge_id = $badge->id;
        $userBadge->granted_at = Carbon::now();

        // As colunas da migração do admin de emblemas; antes dela, só a concessão.
        if ($this->capabilities->adminColumns()) {
            $userBadge->reason = $reason;
            $userBadge->granted_by_id = $actor->id;
        }

        $userBadge->save();
        $userBadge->setRelation('user', $user);

        if ($badge->enabled && $this->settings->badgesEnabled()) {
            $this->notifications->sync(new BadgeGrantedBlueprint($badge, $userBadge), [$user]);
        }

        return $userBadge;
    }

    /** Os emblemas de nível que a pessoa alcançou (depois de uma promoção). */
    public function trustLevelChanged(User $user): void
    {
        $this->trigger(BadgeQueries::TRIGGER_TRUST_LEVEL, Scope::users([$user->id]));
    }

    private function run(Badge $badge, Scope $scope, bool $notify): int
    {
        try {
            return $this->grant($badge, $this->queries->rows($badge, $scope), $notify);
        } catch (Throwable $error) {
            $this->logger->error("[canela] o emblema \"{$badge->slug}\" falhou: {$error->getMessage()}", ['exception' => $error]);

            return 0;
        }
    }

    /**
     * Grava as concessões que ainda não existem.
     *
     * @param list<array{user_id: int, post_id: int|null, granted_at: string|null}> $rows
     */
    public function grant(Badge $badge, array $rows, bool $notify = true): int
    {
        if (! $rows) {
            return 0;
        }

        $rows = $this->withoutExisting($badge, $rows);

        if (! $rows) {
            return 0;
        }

        $now = Carbon::now();
        $threshold = $now->copy()->subHours(self::NOTIFY_WINDOW_HOURS);
        $users = User::query()->whereIn('id', array_unique(array_column($rows, 'user_id')))->get()->keyBy('id');
        $granted = 0;

        foreach ($rows as $row) {
            $user = $users->get($row['user_id']);

            if (! $user) {
                continue;
            }

            $grantedAt = $row['granted_at'] ? Carbon::parse($row['granted_at']) : $now;

            // Uma data no futuro (um relógio de servidor adiantado no banco)
            // não pode deixar o emblema "por vir".
            if ($grantedAt->gt($now)) {
                $grantedAt = $now;
            }

            $userBadge = new UserBadge();
            $userBadge->user_id = $user->id;
            $userBadge->badge_id = $badge->id;
            $userBadge->post_id = $row['post_id'];
            $userBadge->granted_at = $grantedAt;

            try {
                // Numa transação própria (um SAVEPOINT, se já houver uma aberta):
                // no PostgreSQL um erro aborta a transação inteira, e sem o
                // savepoint tudo o que viesse depois deste `catch` falharia.
                $saved = $userBadge->getConnection()->transaction(
                    fn (): bool => $badge->multiple_grant ? $userBadge->save() : $this->singleGrant->save($userBadge)
                );

                if (! $saved) {
                    // Outro processo concedeu no meio do caminho (ver SingleGrantLock).
                    continue;
                }
            } catch (QueryException) {
                // O índice único barrou: outro processo concedeu no meio do caminho.
                continue;
            }

            $granted++;
            $userBadge->setRelation('user', $user);

            if ($notify && $grantedAt->gte($threshold)) {
                $this->notifications->sync(new BadgeGrantedBlueprint($badge, $userBadge), [$user]);
            }
        }

        return $granted;
    }

    /**
     * Tira as linhas que já são concessões. Emblema de concessão única: uma
     * por pessoa. Múltipla com postagem: uma por (pessoa, postagem). Múltipla
     * sem postagem (Aniversário): a própria regra só devolve o que falta.
     *
     * @param list<array{user_id: int, post_id: int|null, granted_at: string|null}> $rows
     * @return list<array{user_id: int, post_id: int|null, granted_at: string|null}>
     */
    private function withoutExisting(Badge $badge, array $rows): array
    {
        $userIds = array_values(array_unique(array_column($rows, 'user_id')));
        $kept = [];

        foreach (array_chunk($userIds, 1000) as $chunk) {
            $existing = UserBadge::query()
                ->where('badge_id', $badge->id)
                ->whereIn('user_id', $chunk)
                ->get(['user_id', 'post_id']);

            $byUser = $existing->groupBy('user_id');

            foreach ($rows as $row) {
                if (! in_array($row['user_id'], $chunk, true)) {
                    continue;
                }

                $userGrants = $byUser->get($row['user_id']);
                $key = $row['user_id'].':'.($row['post_id'] ?? '');

                if (isset($kept[$key])) {
                    continue;
                }

                if (! $badge->multiple_grant) {
                    if ($userGrants || isset($kept[$row['user_id'].':*'])) {
                        continue;
                    }

                    $kept[$row['user_id'].':*'] = true;
                } elseif ($row['post_id'] !== null && $userGrants?->contains('post_id', $row['post_id'])) {
                    continue;
                }

                $kept[$key] = $row;
            }
        }

        return array_values(array_filter($kept, 'is_array'));
    }

    /** @return Collection<string, Badge> */
    private function enabledBadges(): Collection
    {
        return $this->badges ??= Badge::query()
            ->where('enabled', true)
            ->where('system', true)
            ->orderBy('position')
            ->get()
            ->keyBy('slug');
    }
}
