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

namespace Ramon\Canela\Badges\TrustLevel;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\Capabilities;

/**
 * Promoção e rebaixamento automáticos.
 *
 * - Os eventos (post, curtida, leitura) chamam `review()`, que só olha os
 *   níveis 0→1 e 1→2: são consultas baratas, e é onde a pessoa nova espera ver
 *   a promoção logo depois de agir.
 * - O comando diário chama `recalculate()`, que também promove 2→3 e rebaixa
 *   o 3 que deixou de cumprir os requisitos (depois do período de carência).
 * - Nível fixado pelo admin (`canela_trust_level_locked`) não se mexe, e o 4
 *   (Líder) nunca é automático. Fora isso, ninguém perde os níveis 1 e 2: só
 *   o Regular é rebaixado.
 */
final class Promotion
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Capabilities $capabilities,
        private readonly BadgeSettings $settings,
        private readonly BadgeGranter $granter,
        private readonly Dispatcher $events,
    ) {
    }

    public function review(User $user): bool
    {
        if (! $this->canChange($user) || $this->level($user) >= TrustLevel::MEMBER) {
            return false;
        }

        $metrics = UserMetrics::basic($user, $this->db, $this->capabilities);
        $target = $this->level($user);

        if ($target === TrustLevel::NEW_USER && $this->tl1Met($metrics)) {
            $target = TrustLevel::BASIC;
        }

        if ($target === TrustLevel::BASIC && $this->tl2Met($metrics)) {
            $target = TrustLevel::MEMBER;
        }

        return $this->changeTo($user, $target);
    }

    public function recalculate(User $user, bool $grantBadges = true): bool
    {
        if (! $this->canChange($user) || $this->level($user) >= TrustLevel::LEADER) {
            return false;
        }

        $current = $this->level($user);
        $metrics = UserMetrics::full($user, $this->db, $this->capabilities, $this->settings->requirement('tl3_time_period'));

        $target = TrustLevel::NEW_USER;

        if ($this->tl1Met($metrics)) {
            $target = TrustLevel::BASIC;

            if ($this->tl2Met($metrics)) {
                $target = TrustLevel::MEMBER;

                if ($this->tl3Met($metrics)) {
                    $target = TrustLevel::REGULAR;
                }
            }
        }

        if ($target < $current) {
            $target = $current === TrustLevel::REGULAR && $this->tl3GracePeriodOver($user)
                ? max($target, TrustLevel::MEMBER)
                : $current;
        }

        return $this->changeTo($user, $target, $grantBadges);
    }

    /**
     * Grava o nível novo e concede os emblemas de nível (`$grantBadges`
     * falso na carga inicial, que os concede depois sem notificar).
     */
    public function changeTo(User $user, int $level, bool $grantBadges = true): bool
    {
        $from = $this->level($user);

        if (! TrustLevel::valid($level) || $level === $from) {
            return false;
        }

        $now = Carbon::now();

        // UPDATE direto, e não `$user->save()`: a promoção acontece no meio de
        // outras ações (um post, uma curtida), e salvar o modelo inteiro
        // gravaria junto qualquer outra alteração pendente nele.
        $this->db->table('users')->where('id', $user->id)->update([
            'canela_trust_level' => $level,
            'canela_trust_level_at' => $now,
        ]);

        // No modelo também, marcado como já gravado só nessas duas colunas: o
        // resto do que estiver pendente continua pendente.
        $user->setAttribute('canela_trust_level', $level);
        $user->setAttribute('canela_trust_level_at', $now);
        $user->syncOriginalAttributes(['canela_trust_level', 'canela_trust_level_at']);

        if ($grantBadges) {
            $this->granter->trustLevelChanged($user);

            $this->events->dispatch(new TrustLevelChanged($user, $from, $level));
        }

        return true;
    }

    public function tl1Met(UserMetrics $m): bool
    {
        return $m->topicsEntered >= $this->req('tl1_requires_topics_entered')
            && $m->postsRead >= $this->req('tl1_requires_read_posts')
            && $this->measured($m->timeReadMinutes, 'tl1_requires_time_spent_mins');
    }

    public function tl2Met(UserMetrics $m): bool
    {
        return $m->topicsEntered >= $this->req('tl2_requires_topics_entered')
            && $m->postsRead >= $this->req('tl2_requires_read_posts')
            && $this->measured($m->timeReadMinutes, 'tl2_requires_time_spent_mins')
            // Também tempo de casa: ninguém vira Membro na primeira hora.
            && $m->minutesSinceJoin >= $this->req('tl2_requires_time_spent_mins')
            && $m->daysVisited >= $this->req('tl2_requires_days_visited')
            && $this->measured($m->likesReceived, 'tl2_requires_likes_received')
            && $this->measured($m->likesGiven, 'tl2_requires_likes_given')
            && $m->topicReplyCount >= $this->req('tl2_requires_topic_reply_count');
    }

    /** O `TrustLevel3Requirements#requirements_met?`. */
    public function tl3Met(UserMetrics $m): bool
    {
        $topicsViewed = min(
            (int) ceil($m->periodTopicsCreated * $this->req('tl3_requires_topics_viewed') / 100),
            $this->req('tl3_requires_topics_viewed_cap')
        );

        $postsRead = min(
            (int) ceil($m->periodPostsCreated * $this->req('tl3_requires_posts_read') / 100),
            $this->req('tl3_requires_posts_read_cap')
        );

        return ! $m->suspendedRecently
            && $m->periodDaysVisited >= $this->req('tl3_requires_days_visited')
            && $m->periodTopicsRepliedTo >= $this->req('tl3_requires_topics_replied_to')
            && $m->periodTopicsViewed >= $topicsViewed
            && $m->periodPostsRead >= $postsRead
            && $m->topicsEntered >= $this->req('tl3_requires_topics_viewed_all_time')
            && $m->postsRead >= $this->req('tl3_requires_posts_read_all_time')
            && ($m->periodFlaggedPosts === null || $m->periodFlaggedPosts <= $this->req('tl3_requires_max_flagged'))
            && $this->measured($m->periodLikesGiven, 'tl3_requires_likes_given')
            && $this->measured($m->periodLikesReceived, 'tl3_requires_likes_received');
    }

    public function level(User $user): int
    {
        return (int) ($user->getAttribute('canela_trust_level') ?? 0);
    }

    private function canChange(User $user): bool
    {
        return $this->settings->trustLevelsEnabled() && ! $user->getAttribute('canela_trust_level_locked');
    }

    /** Um Regular não é rebaixado nos primeiros 100 dias. */
    private function tl3GracePeriodOver(User $user): bool
    {
        $changedAt = $user->getAttribute('canela_trust_level_at');

        return ! $changedAt || Carbon::parse($changedAt)->lte(Carbon::now()->subDays($this->req('tl3_promotion_min_duration')));
    }

    /** Requisito de algo que este fórum pode não medir: sem medida, não barra. */
    private function measured(?int $value, string $requirement): bool
    {
        return $value === null || $value >= $this->req($requirement);
    }

    private function req(string $name): int
    {
        return $this->settings->requirement($name);
    }
}
