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
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Ramon\Canela\Badges\Capabilities;

/**
 * Os números de uma pessoa que os requisitos de nível comparam, mais as
 * janelas dos requisitos do nível 3.
 *
 * Com o recurso de estatísticas do tema (canela_user_visits e
 * canela_topic_views), os números são exatos. Sem ele, cada um cai
 * para o que o core do Flarum guarda:
 *
 * - tópicos vistos e postagens lidas: o estado de leitura de cada discussão
 *   (`discussion_user`), que diz até que postagem a pessoa leu;
 * - dias visitados: dias desde o cadastro;
 * - tempo de leitura: não há como medir — fica `null`, e o requisito não conta.
 *
 * `null` sempre quer dizer "não medido neste fórum" (curtidas sem o
 * flarum/likes, sinalizações sem o flarum/flags), e nunca zero: um requisito
 * que não dá para medir não pode barrar ninguém.
 */
final class UserMetrics
{
    public int $topicsEntered = 0;

    public int $postsRead = 0;

    public ?int $timeReadMinutes = null;

    public int $daysVisited = 0;

    public ?int $likesReceived = null;

    public ?int $likesGiven = null;

    public int $topicReplyCount = 0;

    public int $minutesSinceJoin = 0;

    // Janela do nível 3 (os últimos `tl3_time_period` dias)
    public int $periodDaysVisited = 0;

    public int $periodTopicsRepliedTo = 0;

    public int $periodTopicsViewed = 0;

    public int $periodPostsRead = 0;

    public ?int $periodLikesGiven = null;

    public ?int $periodLikesReceived = null;

    public ?int $periodFlaggedPosts = null;

    /** Tópicos e postagens criados no fórum na janela: a base das porcentagens. */
    public int $periodTopicsCreated = 0;

    public int $periodPostsCreated = 0;

    public bool $suspendedRecently = false;

    /**
     * Totais do fórum na janela, por tamanho de janela: são os mesmos para
     * todas as pessoas, e a revisão diária mede milhares delas seguidas.
     *
     * @var array<int, array{expires: int, totals: array{int, int}}>
     */
    private static array $forumTotals = [];

    private const FORUM_TOTALS_TTL = 600;

    private function __construct()
    {
    }

    /** @return array{int, int} tópicos e postagens criados no fórum desde `$since` */
    private static function forumTotals(ConnectionInterface $db, Carbon $since, int $periodDays): array
    {
        $cached = self::$forumTotals[$periodDays] ?? null;

        if ($cached !== null && $cached['expires'] > time()) {
            return $cached['totals'];
        }

        $totals = [
            $db->table('discussions')
                ->whereNull('hidden_at')->where('is_private', false)->where('created_at', '>=', $since)->count(),
            $db->table('posts')
                ->where('type', 'comment')->whereNull('hidden_at')->where('is_private', false)->where('created_at', '>=', $since)->count(),
        ];

        self::$forumTotals[$periodDays] = ['expires' => time() + self::FORUM_TOTALS_TTL, 'totals' => $totals];

        return $totals;
    }

    /** Só os números dos níveis 1 e 2 — o que os eventos precisam, sem as janelas do 3. */
    public static function basic(User $user, ConnectionInterface $db, Capabilities $capabilities): self
    {
        $metrics = new self();
        $metrics->fillAllTime($user, $db, $capabilities);

        return $metrics;
    }

    public static function full(User $user, ConnectionInterface $db, Capabilities $capabilities, int $periodDays): self
    {
        $metrics = self::basic($user, $db, $capabilities);
        $metrics->fillPeriod($user, $db, $capabilities, Carbon::now()->subDays(max(1, $periodDays)), $periodDays);

        return $metrics;
    }

    private function fillAllTime(User $user, ConnectionInterface $db, Capabilities $capabilities): void
    {
        $joinedAt = $user->joined_at ? Carbon::parse($user->joined_at) : Carbon::now();
        $this->minutesSinceJoin = (int) max(0, $joinedAt->diffInMinutes(Carbon::now()));

        if ($capabilities->topicViews()) {
            $this->topicsEntered = $db->table('canela_topic_views')->where('user_id', $user->id)->count();
        } else {
            $this->topicsEntered = $this->readStates($db, $user)->count();
        }

        if ($capabilities->visits()) {
            // Uma consulta só para as três somas (eram três).
            $visits = $db->table('canela_user_visits')
                ->where('user_id', $user->id)
                ->selectRaw('COUNT(*) as days, COALESCE(SUM(posts_read), 0) as posts, COALESCE(SUM(time_read), 0) as seconds')
                ->first();
            $this->postsRead = (int) ($visits->posts ?? 0);
            // Tempo de leitura guardado em segundos.
            $this->timeReadMinutes = intdiv((int) ($visits->seconds ?? 0), 60);
            $this->daysVisited = (int) ($visits->days ?? 0);
        } else {
            $this->postsRead = (int) $this->readStates($db, $user)->sum('discussion_user.last_read_post_number');
            $this->daysVisited = intdiv($this->minutesSinceJoin, 60 * 24);
        }

        if ($capabilities->likes()) {
            $this->likesGiven = $db->table('post_likes')->where('user_id', $user->id)->count();
            $this->likesReceived = $this->likesReceivedQuery($db, $user)->count();
        }

        $this->topicReplyCount = $this->repliesQuery($db, $user)->distinct()->count('posts.discussion_id');
    }

    private function fillPeriod(User $user, ConnectionInterface $db, Capabilities $capabilities, Carbon $since, int $periodDays): void
    {
        if ($capabilities->visits()) {
            $visits = $db->table('canela_user_visits')->where('user_id', $user->id)->where('visited_at', '>=', $since->toDateString());
            $this->periodDaysVisited = (clone $visits)->count();
            $this->periodPostsRead = (int) (clone $visits)->sum('posts_read');
        } else {
            $this->periodDaysVisited = min($periodDays, $this->daysVisited);
            $this->periodPostsRead = (int) $this->readStates($db, $user)->where('discussion_user.last_read_at', '>=', $since)->sum('discussion_user.last_read_post_number');
        }

        $this->periodTopicsViewed = $capabilities->topicViews()
            ? $db->table('canela_topic_views')->where('user_id', $user->id)->where('viewed_at', '>=', $since)->count()
            : $this->readStates($db, $user)->where('discussion_user.last_read_at', '>=', $since)->count();

        $this->periodTopicsRepliedTo = $this->repliesQuery($db, $user)->where('posts.created_at', '>=', $since)->distinct()->count('posts.discussion_id');

        [$this->periodTopicsCreated, $this->periodPostsCreated] = self::forumTotals($db, $since, $periodDays);

        if ($capabilities->likes()) {
            $this->periodLikesGiven = $capabilities->likeDates()
                ? $db->table('post_likes')->where('user_id', $user->id)->where('created_at', '>=', $since)->count()
                : $this->likesGiven;
            $this->periodLikesReceived = $capabilities->likeDates()
                ? $this->likesReceivedQuery($db, $user)->where('post_likes.created_at', '>=', $since)->count()
                : $this->likesReceived;
        }

        if ($capabilities->flags()) {
            // Postagens da pessoa sinalizadas por outras pessoas na janela. O
            // Flarum apaga a sinalização dispensada, então o que resta é o que a
            // moderação não descartou — o mais perto de uma sinalização "concordada".
            $this->periodFlaggedPosts = $db->table('flags')
                ->join('posts', 'posts.id', '=', 'flags.post_id')
                ->where('posts.user_id', $user->id)
                ->whereColumn('flags.user_id', '!=', 'posts.user_id')
                ->where('flags.created_at', '>=', $since)
                ->distinct()
                ->count('flags.post_id');
        }

        if ($capabilities->suspensions() && $user->suspended_until) {
            $this->suspendedRecently = Carbon::parse($user->suspended_until)->gte(Carbon::now()->subMonths(6));
        }
    }

    /** Discussões com estado de leitura: as que a pessoa abriu. */
    private function readStates(ConnectionInterface $db, User $user): Builder
    {
        return $db->table('discussion_user')
            ->where('discussion_user.user_id', $user->id)
            ->where('discussion_user.last_read_post_number', '>', 0);
    }

    /** Respostas a tópicos de outras pessoas. */
    private function repliesQuery(ConnectionInterface $db, User $user): Builder
    {
        return $db->table('posts')
            ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
            ->where('posts.user_id', $user->id)
            ->where('posts.type', 'comment')
            ->where('posts.number', '>', 1)
            ->whereNull('posts.hidden_at')
            ->where('discussions.is_private', false)
            // Tópico de conta apagada (`user_id` nulo) também é de outra
            // pessoa; só o `!=` comparava com NULL e o deixava de fora.
            ->where(fn (Builder $query) => $query
                ->whereNull('discussions.user_id')
                ->orWhereColumn('discussions.user_id', '!=', 'posts.user_id'));
    }

    private function likesReceivedQuery(ConnectionInterface $db, User $user): Builder
    {
        return $db->table('post_likes')
            ->join('posts', 'posts.id', '=', 'post_likes.post_id')
            ->where('posts.user_id', $user->id)
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id');
    }
}
