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
use Flarum\Foundation\Config;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * As regras de cada emblema do sistema: cada uma devolve quem merece o
 * emblema (e por qual postagem),
 * dentro de um recorte — a carga completa ou só o que um evento tocou.
 *
 * As consultas são escritas com o query builder, e não em SQL cru, por dois
 * motivos: o Flarum aceita prefixo de tabela (um nome escrito à mão quebraria),
 * e roda em MySQL, PostgreSQL e SQLite. As poucas expressões cruas passam pelo
 * `wrap()`, que aplica o prefixo e as aspas do banco.
 *
 * Cada linha devolvida é `['user_id' => int, 'post_id' => ?int, 'granted_at'
 * => ?string]`; quem decide se a concessão já existe é o BadgeGranter.
 */
final class BadgeQueries
{
    public const TRIGGER_POST = 'post';

    public const TRIGGER_LIKE = 'like';

    public const TRIGGER_FLAG = 'flag';

    public const TRIGGER_READ = 'read';

    public const TRIGGER_USER = 'user';

    public const TRIGGER_TRUST_LEVEL = 'trust_level';

    /** Só na carga diária. */
    public const TRIGGER_DAILY = 'daily';

    /**
     * slug => [gatilho, requisito (método de Capabilities) ou null].
     *
     * @var array<string, array{0: string, 1: string|null}>
     */
    public const RULES = [
        'first_like' => [self::TRIGGER_LIKE, 'likes'],
        'welcome' => [self::TRIGGER_LIKE, 'likes'],
        'nice_post' => [self::TRIGGER_LIKE, 'likes'],
        'good_post' => [self::TRIGGER_LIKE, 'likes'],
        'great_post' => [self::TRIGGER_LIKE, 'likes'],
        'nice_topic' => [self::TRIGGER_LIKE, 'likes'],
        'good_topic' => [self::TRIGGER_LIKE, 'likes'],
        'great_topic' => [self::TRIGGER_LIKE, 'likes'],

        'editor' => [self::TRIGGER_POST, null],
        'first_quote' => [self::TRIGGER_POST, null],
        'first_link' => [self::TRIGGER_POST, null],
        'first_mention' => [self::TRIGGER_POST, 'mentions'],
        'first_emoji' => [self::TRIGGER_POST, null],

        'first_flag' => [self::TRIGGER_FLAG, 'flags'],
        'reader' => [self::TRIGGER_READ, null],
        'autobiographer' => [self::TRIGGER_USER, 'bio'],

        'basic_user' => [self::TRIGGER_TRUST_LEVEL, null],
        'member' => [self::TRIGGER_TRUST_LEVEL, null],
        'regular' => [self::TRIGGER_TRUST_LEVEL, null],
        'leader' => [self::TRIGGER_TRUST_LEVEL, null],

        'anniversary' => [self::TRIGGER_DAILY, null],
        'appreciated' => [self::TRIGGER_DAILY, 'likes'],
        'respected' => [self::TRIGGER_DAILY, 'likes'],
        'admired' => [self::TRIGGER_DAILY, 'likes'],
        'thank_you' => [self::TRIGGER_DAILY, 'likes'],
        'gives_back' => [self::TRIGGER_DAILY, 'likes'],
        'empathetic' => [self::TRIGGER_DAILY, 'likes'],
        'out_of_love' => [self::TRIGGER_DAILY, 'likeDates'],
        'higher_love' => [self::TRIGGER_DAILY, 'likeDates'],
        'crazy_in_love' => [self::TRIGGER_DAILY, 'likeDates'],
        'enthusiast' => [self::TRIGGER_DAILY, 'visits'],
        'aficionado' => [self::TRIGGER_DAILY, 'visits'],
        'devotee' => [self::TRIGGER_DAILY, 'visits'],
        'new_user_of_the_month' => [self::TRIGGER_DAILY, 'likes'],
    ];

    /**
     * Emblemas que só se descobrem lendo o conteúdo de cada postagem, sem um
     * filtro em SQL que corte o volume. Na carga diária ficam de fora (os
     * eventos de postagem já os concedem); só a carga completa os percorre.
     */
    public const CONTENT_SCANS = ['first_emoji'];

    /** Curtidas por postagem dos emblemas de postagem e de tópico (`Badge.like_badge_counts`). */
    private const LIKE_BADGE_COUNTS = [
        'nice_post' => 10, 'good_post' => 25, 'great_post' => 50,
        'nice_topic' => 10, 'good_topic' => 25, 'great_topic' => 50,
    ];

    /** [curtidas por postagem, postagens] — `liked_posts(post_count, like_count)`. */
    private const LIKED_POSTS = ['appreciated' => [1, 20], 'respected' => [2, 100], 'admired' => [5, 300]];

    /** [postagens curtidas, curtidas dadas] — `liked_back(likes_received, likes_given)`. */
    private const LIKED_BACK = ['thank_you' => [20, 10], 'gives_back' => [100, 100], 'empathetic' => [500, 1000]];

    /** Dias em que bateu o limite diário de curtidas — `like_rate_limit(count)`. */
    private const LIKE_RATE_LIMIT = ['out_of_love' => 1, 'higher_love' => 5, 'crazy_in_love' => 20];

    /** Dias seguidos de visita — `consecutive_visits(days)`. */
    private const CONSECUTIVE_VISITS = ['enthusiast' => 10, 'aficionado' => 100, 'devotee' => 365];

    /** Comprimento mínimo da bio (`Badge::AutobiographerMinBioLength`). */
    private const AUTOBIOGRAPHER_MIN_BIO_LENGTH = 10;

    /** Tópicos com mais respostas que isto contam para o "Leitor(a)". */
    private const READER_MIN_POSTS = 100;

    /** Quantos "Novo(a) usuário(a) do mês" por mês. */
    private const NEW_USER_OF_THE_MONTH_AWARDS = 2;

    private const CHUNK = 500;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Capabilities $capabilities,
        private readonly BadgeSettings $settings,
        private readonly Config $config,
    ) {
    }

    /** O emblema tem regra e o fórum tem o que ela precisa medir. */
    public function available(string $slug): bool
    {
        if (! isset(self::RULES[$slug])) {
            return false;
        }

        [$trigger, $requirement] = self::RULES[$slug];

        // Com os níveis desligados no admin, os emblemas deles não têm de onde vir.
        if ($trigger === self::TRIGGER_TRUST_LEVEL && ! $this->settings->trustLevelsEnabled()) {
            return false;
        }

        return $requirement === null || $this->capabilities->{$requirement}();
    }

    /** @return list<string> */
    public function slugsFor(string $trigger): array
    {
        return array_keys(array_filter(self::RULES, fn (array $rule) => $rule[0] === $trigger));
    }

    /**
     * Quem merece o emblema dentro do recorte.
     *
     * @return list<array{user_id: int, post_id: int|null, granted_at: string|null}>
     */
    public function rows(Badge $badge, Scope $scope): array
    {
        $slug = $badge->slug;

        if (! $this->available($slug)) {
            return [];
        }

        return match (true) {
            $slug === 'first_like' => $this->firstLike($scope),
            $slug === 'welcome' => $this->welcome($scope),
            isset(self::LIKE_BADGE_COUNTS[$slug]) => $this->likeBadge(self::LIKE_BADGE_COUNTS[$slug], str_ends_with($slug, '_topic'), $scope),
            $slug === 'editor' => $this->editor($scope),
            $slug === 'first_quote' => $this->firstQuote($scope),
            $slug === 'first_link' => $this->firstLink($badge, $scope),
            $slug === 'first_mention' => $this->firstMention($scope),
            $slug === 'first_emoji' => $this->firstEmoji($badge, $scope),
            $slug === 'first_flag' => $this->firstFlag($scope),
            $slug === 'reader' => $this->reader($scope),
            $slug === 'autobiographer' => $this->autobiographer($scope),
            in_array($slug, SystemBadges::TRUST_LEVEL_BADGES, true) => $this->trustLevel((int) array_search($slug, SystemBadges::TRUST_LEVEL_BADGES, true), $scope),
            $slug === 'anniversary' => $this->anniversary($badge, $scope),
            isset(self::LIKED_POSTS[$slug]) => $this->likedPosts(...[...self::LIKED_POSTS[$slug], $scope]),
            isset(self::LIKED_BACK[$slug]) => $this->likedBack(...[...self::LIKED_BACK[$slug], $scope]),
            isset(self::LIKE_RATE_LIMIT[$slug]) => $this->likeRateLimit(self::LIKE_RATE_LIMIT[$slug], $scope),
            isset(self::CONSECUTIVE_VISITS[$slug]) => $this->consecutiveVisits($badge, self::CONSECUTIVE_VISITS[$slug], $scope),
            $slug === 'new_user_of_the_month' => $this->newUserOfTheMonth($badge, $scope),
            default => [],
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Curtidas
    // ─────────────────────────────────────────────────────────────────────

    private function firstLike(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
            // Curtir a própria postagem (o flarum/likes pode permitir) não é
            // "curtir uma postagem" no sentido do emblema.
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id')
            ->select('post_likes.user_id')
            ->selectRaw('MIN('.$this->wrap('post_likes.post_id').') AS post_id')
            ->groupBy('post_likes.user_id');

        $this->selectFirstLikeDate($query);
        $this->scopeUsers($query, $scope, 'post_likes.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->collect($query);
    }

    private function welcome(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id')
            ->select('posts.user_id')
            ->selectRaw('MIN('.$this->wrap('posts.id').') AS post_id')
            ->groupBy('posts.user_id');

        $this->selectFirstLikeDate($query);
        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->collect($query);
    }

    /** Postagem (resposta) ou tópico (primeira postagem) com N curtidas — concessão múltipla. */
    private function likeBadge(int $count, bool $topic, Scope $scope): array
    {
        $likes = $this->likeCounts();

        if ($scope->postIds !== null) {
            $likes->whereIn('post_likes.post_id', $scope->postIds);
        }

        $query = $this->badgePosts()
            ->joinSub($likes, 'canela_lc', 'canela_lc.post_id', '=', 'posts.id')
            ->where('canela_lc.like_count', '>=', $count)
            ->where('posts.number', $topic ? '=' : '>', 1)
            ->select('posts.user_id', 'posts.id as post_id');

        $this->scopeUsers($query, $scope, 'posts.user_id');

        return $this->collect($query);
    }

    /** `liked_posts`: N postagens com pelo menos L curtidas cada. */
    private function likedPosts(int $likeCount, int $postCount, Scope $scope): array
    {
        $query = $this->badgePosts()
            ->joinSub($this->likeCounts(), 'canela_lc', 'canela_lc.post_id', '=', 'posts.id')
            ->where('canela_lc.like_count', '>=', $likeCount)
            ->select('posts.user_id')
            ->groupBy('posts.user_id')
            ->havingRaw('COUNT(*) >= ?', [$postCount]);

        $this->scopeUsers($query, $scope, 'posts.user_id');

        return $this->collect($query);
    }

    /** `liked_back`: N postagens curtidas e pelo menos G curtidas dadas. */
    private function likedBack(int $likedPosts, int $likesGiven, Scope $scope): array
    {
        $liked = $this->badgePosts()
            ->whereExists(fn (Builder $exists) => $exists->selectRaw('1')->from('post_likes')->whereColumn('post_likes.post_id', 'posts.id'))
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) AS liked_posts')
            ->groupBy('posts.user_id');

        $given = $this->db->table('post_likes')
            ->select('user_id')
            ->selectRaw('COUNT(*) AS likes_given')
            ->groupBy('user_id');

        $this->scopeUsers($liked, $scope, 'posts.user_id');

        $query = $this->db->query()
            ->fromSub($liked, 'canela_lp')
            ->joinSub($given, 'canela_lg', 'canela_lg.user_id', '=', 'canela_lp.user_id')
            ->where('canela_lp.liked_posts', '>=', $likedPosts)
            ->where('canela_lg.likes_given', '>=', $likesGiven)
            ->select('canela_lp.user_id');

        return $this->collect($query);
    }

    /**
     * `like_rate_limit`: dias em que a pessoa usou todas as curtidas do dia.
     * O Flarum não limita curtidas, então o "limite" é a configuração
     * `canela.badges_max_likes_per_day` (padrão 50).
     */
    private function likeRateLimit(int $days, Scope $scope): array
    {
        $day = 'DATE('.$this->wrap('created_at').')';

        $perDay = $this->db->table('post_likes')
            ->select('user_id')
            ->selectRaw("$day AS liked_on")
            ->whereNotNull('created_at')
            ->groupBy('user_id')
            ->groupByRaw($day)
            ->havingRaw('COUNT(*) >= ?', [$this->settings->maxLikesPerDay()]);

        $this->scopeUsers($perDay, $scope, 'user_id');

        $query = $this->db->query()
            ->fromSub($perDay, 'canela_ld')
            ->select('canela_ld.user_id')
            ->groupBy('canela_ld.user_id')
            ->havingRaw('COUNT(*) >= ?', [$days]);

        return $this->collect($query);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Postagens
    // ─────────────────────────────────────────────────────────────────────

    /** "Incorreto, mas bom o bastante": a postagem editada mais antiga, não a primeira edição. */
    private function editor(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->whereNotNull('posts.edited_at')
            ->whereColumn('posts.edited_user_id', 'posts.user_id')
            ->select('posts.user_id')
            ->selectRaw('MIN('.$this->wrap('posts.id').') AS post_id')
            ->selectRaw('MIN('.$this->wrap('posts.edited_at').') AS granted_at')
            ->groupBy('posts.user_id');

        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->collect($query);
    }

    /**
     * A citação do Flarum é um bloco de citação (`> @fulano#12 …`), que o
     * formatador grava como `<QUOTE>`. Responder com uma menção, sem citar,
     * não conta.
     */
    private function firstQuote(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->where('posts.content', 'like', '%<QUOTE%')
            ->select('posts.user_id')
            ->selectRaw('MIN('.$this->wrap('posts.id').') AS post_id')
            ->selectRaw('MIN('.$this->wrap('posts.created_at').') AS granted_at')
            ->groupBy('posts.user_id');

        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->collect($query);
    }

    private function firstMention(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->join('post_mentions_user', 'post_mentions_user.post_id', '=', 'posts.id')
            ->whereColumn('post_mentions_user.mentions_user_id', '!=', 'posts.user_id')
            ->select('posts.user_id')
            ->selectRaw('MIN('.$this->wrap('posts.id').') AS post_id')
            ->selectRaw('MIN('.$this->wrap('posts.created_at').') AS granted_at')
            ->groupBy('posts.user_id');

        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->collect($query);
    }

    /**
     * Link para OUTRO tópico do fórum. O SQL só separa as postagens com
     * "/d/" no conteúdo; o endereço (e se o tópico é outro) se confere aqui.
     */
    private function firstLink(Badge $badge, Scope $scope): array
    {
        $base = preg_quote(rtrim((string) $this->config->url(), '/'), '#');
        // Endereço absoluto do fórum ou caminho relativo, dentro de um atributo
        // (url="…") ou do texto do link.
        $pattern = '#(?:'.$base.'|["\'(\s>])/d/(\d+)#';

        $query = $this->badgePosts()
            ->where('posts.content', 'like', '%/d/%')
            ->select('posts.id', 'posts.user_id', 'posts.discussion_id', 'posts.content', 'posts.created_at');

        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->firstPerUser($badge, $query, static function (object $post) use ($pattern): bool {
            if (! preg_match_all($pattern, (string) $post->content, $matches)) {
                return false;
            }

            foreach ($matches[1] as $discussionId) {
                if ((int) $discussionId !== (int) $post->discussion_id) {
                    return true;
                }
            }

            return false;
        });
    }

    /**
     * Emoji Unicode ou emoticon (o flarum/emoji grava `:)` como `<E>`). Não há
     * como procurar faixas Unicode em SQL portável, então isto lê o conteúdo.
     */
    private function firstEmoji(Badge $badge, Scope $scope): array
    {
        $query = $this->badgePosts()->select('posts.id', 'posts.user_id', 'posts.content', 'posts.created_at');

        $this->scopeUsers($query, $scope, 'posts.user_id');
        $this->scopePosts($query, $scope, 'posts.id');

        return $this->firstPerUser($badge, $query, static function (object $post): bool {
            $content = (string) $post->content;

            return str_contains($content, '<E>')
                || str_contains($content, '<EMOJI')
                || preg_match('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F1E6}-\x{1F1FF}]/u', $content) === 1;
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Leitura, perfil, sinalizações
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Quem sinalizou: o emblema não guarda a postagem — mostrá-la diria em
     * público quem sinalizou o quê.
     */
    private function firstFlag(Scope $scope): array
    {
        $query = $this->badgePosts()
            ->join('flags', 'flags.post_id', '=', 'posts.id')
            ->whereNotNull('flags.user_id')
            ->select('flags.user_id')
            ->selectRaw('MIN('.$this->wrap('flags.created_at').') AS granted_at')
            ->groupBy('flags.user_id');

        $this->scopeUsers($query, $scope, 'flags.user_id');

        return $this->collect($query);
    }

    /** Leu até o fim (o estado de leitura do core) um tópico com mais de 100 respostas. */
    private function reader(Scope $scope): array
    {
        $query = $this->db->table('discussion_user')
            ->join('discussions', 'discussions.id', '=', 'discussion_user.discussion_id')
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false)
            ->where('discussions.comment_count', '>', self::READER_MIN_POSTS)
            ->whereColumn('discussion_user.last_read_post_number', '>=', 'discussions.last_post_number')
            ->select('discussion_user.user_id')
            ->selectRaw('MIN('.$this->wrap('discussion_user.last_read_at').') AS granted_at')
            ->groupBy('discussion_user.user_id');

        $this->scopeUsers($query, $scope, 'discussion_user.user_id');

        return $this->collect($query);
    }

    /** Bio com mais de 10 caracteres e uma foto de perfil. */
    private function autobiographer(Scope $scope): array
    {
        $query = $this->db->table('users')
            ->whereNotNull('canela_bio')
            ->whereNotNull('avatar_url')
            ->whereRaw('LENGTH(TRIM('.$this->wrap('canela_bio').')) > ?', [self::AUTOBIOGRAPHER_MIN_BIO_LENGTH])
            ->select('id as user_id');

        $this->scopeUsers($query, $scope, 'id');

        return $this->collect($query);
    }

    private function trustLevel(int $level, Scope $scope): array
    {
        $query = $this->db->table('users')
            ->where('canela_trust_level', '>=', $level)
            ->select('id as user_id');

        $this->scopeUsers($query, $scope, 'id');

        return $this->collect($query);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Tempo
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Um ano de casa com pelo menos uma postagem no último ano; concedido uma
     * vez por ano, na data do aniversário de cadastro.
     */
    private function anniversary(Badge $badge, Scope $scope): array
    {
        $now = Carbon::now();
        $yearAgo = $now->copy()->subYear();

        $query = $this->db->table('users')
            ->where('users.joined_at', '<=', $yearAgo)
            // Conta ativa: e-mail confirmado.
            ->where('users.is_email_confirmed', true)
            ->whereExists(function (Builder $exists) use ($yearAgo) {
                $this->applyBadgePostConstraints($exists->selectRaw('1')->from('posts'))
                    ->whereColumn('posts.user_id', 'users.id')
                    ->where('posts.created_at', '>=', $yearAgo);
            })
            ->select('users.id', 'users.joined_at');

        $this->scopeUsers($query, $scope, 'users.id');

        $rows = [];

        $query->orderBy('users.id')->chunk(self::CHUNK, function ($users) use ($badge, $now, &$rows) {
            $lastGrants = $this->db->table('canela_user_badges')
                ->where('badge_id', $badge->id)
                ->whereIn('user_id', $users->pluck('id')->all())
                ->groupBy('user_id')
                ->selectRaw($this->wrap('user_id').' AS user_id, MAX('.$this->wrap('granted_at').') AS last_granted')
                ->pluck('last_granted', 'user_id');

            foreach ($users as $user) {
                $joinedAt = Carbon::parse($user->joined_at);
                $years = (int) $joinedAt->diffInYears($now);
                $anniversaryAt = $joinedAt->copy()->addYears($years);

                $last = $lastGrants[$user->id] ?? null;

                if ($years < 1 || ($last !== null && Carbon::parse($last)->gte($anniversaryAt))) {
                    continue;
                }

                $rows[] = ['user_id' => (int) $user->id, 'post_id' => null, 'granted_at' => $anniversaryAt->toDateTimeString()];
            }
        });

        return $rows;
    }

    /**
     * Dias seguidos de visita (`canela_user_visits`, do recurso de
     * estatísticas). Concedido no dia em que a sequência completou N dias.
     */
    private function consecutiveVisits(Badge $badge, int $days, Scope $scope): array
    {
        $candidates = $this->db->table('canela_user_visits')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) >= ?', [$days]);

        $this->scopeUsers($candidates, $scope, 'user_id');

        // Qualificada: sem a tabela, o `user_id` da subconsulta seria o dela mesma.
        $this->excludeGranted($candidates, $badge, 'canela_user_visits.user_id');

        $rows = [];

        // As datas de um lote de pessoas numa consulta só, e não uma consulta
        // por pessoa a cada dia.
        foreach ($candidates->pluck('user_id')->chunk(200) as $chunk) {
            $visits = $this->db->table('canela_user_visits')
                ->whereIn('user_id', $chunk->all())
                ->orderBy('user_id')
                ->orderBy('visited_at')
                ->get(['user_id', 'visited_at'])
                ->groupBy('user_id');

            foreach ($visits as $userId => $dates) {
                $completedOn = self::streakCompletedOn($dates->pluck('visited_at'), $days);

                if ($completedOn !== null) {
                    $rows[] = ['user_id' => (int) $userId, 'post_id' => null, 'granted_at' => $completedOn.' 00:00:00'];
                }
            }
        }

        return $rows;
    }

    /**
     * O dia (`Y-m-d`) em que a primeira sequência de N dias seguidos se
     * completou, ou null. As datas vêm em ordem crescente, uma por dia.
     *
     * Compara as datas como texto (o dia seguinte de uma é a outra), e não
     * pela diferença em dias: num fuso com horário de verão, a meia-noite de
     * dois dias seguidos pode distar 23 h, e o `(int) diffInDays` dava 0 —
     * a sequência quebrava sem motivo.
     *
     * @param iterable<mixed> $dates
     */
    public static function streakCompletedOn(iterable $dates, int $days): ?string
    {
        $streak = 0;
        $previous = null;

        foreach ($dates as $visitedAt) {
            $day = Carbon::parse((string) $visitedAt)->toDateString();
            $streak = $previous !== null && Carbon::parse($previous)->addDay()->toDateString() === $day ? $streak + 1 : 1;
            $previous = $day;

            if ($streak >= $days) {
                return $day;
            }
        }

        return null;
    }

    /**
     * Os dois membros novos (cadastrados no mês anterior) com mais curtidas de
     * pessoas diferentes nas postagens daquele mês. Uma vez por mês: se já
     * houve concessão neste mês, não há o que fazer.
     */
    private function newUserOfTheMonth(Badge $badge, Scope $scope): array
    {
        if (! $scope->isBackfill()) {
            return [];
        }

        $monthStart = Carbon::now()->startOfMonth();
        $periodStart = $monthStart->copy()->subMonth();

        $alreadyAwarded = $this->db->table('canela_user_badges')
            ->where('badge_id', $badge->id)
            ->where('granted_at', '>=', $monthStart)
            ->exists();

        if ($alreadyAwarded) {
            return [];
        }

        $query = $this->badgePosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
            ->join('users', 'users.id', '=', 'posts.user_id')
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id')
            ->where('users.joined_at', '>=', $periodStart)
            ->where('users.joined_at', '<', $monthStart)
            ->where('posts.created_at', '>=', $periodStart)
            ->where('posts.created_at', '<', $monthStart)
            // A equipe não concorre: o emblema é para quem acabou de chegar.
            ->whereNotExists(fn (Builder $staff) => $staff->selectRaw('1')->from('group_user')->whereColumn('group_user.user_id', 'users.id')->whereIn('group_user.group_id', [1, 4]))
            ->select('posts.user_id')
            ->selectRaw('COUNT(DISTINCT '.$this->wrap('post_likes.user_id').') AS score')
            ->groupBy('posts.user_id')
            ->orderByDesc('score')
            ->orderBy('posts.user_id')
            ->limit(self::NEW_USER_OF_THE_MONTH_AWARDS);

        return array_map(fn (object $row) => [
            'user_id' => (int) $row->user_id,
            'post_id' => null,
            'granted_at' => $monthStart->toDateTimeString(),
        ], $query->get()->all());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Peças
    // ─────────────────────────────────────────────────────────────────────

    /**
     * As postagens que contam para emblemas: comentários visíveis em
     * tópicos públicos. Postagens escondidas, privadas (aguardando aprovação)
     * ou de tópicos escondidos não rendem emblema.
     */
    private function badgePosts(): Builder
    {
        return $this->applyBadgePostConstraints($this->db->table('posts'));
    }

    private function applyBadgePostConstraints(Builder $query): Builder
    {
        return $query
            ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
            ->where('posts.type', 'comment')
            ->whereNotNull('posts.user_id')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false)
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false);
    }

    /**
     * Curtidas por postagem, sem as do próprio autor: curtir o próprio post
     * não rende emblema (como a "Primeira curtida" e o "Novato do mês").
     */
    private function likeCounts(): Builder
    {
        return $this->db->table('post_likes')
            ->join('posts as canela_liked', 'canela_liked.id', '=', 'post_likes.post_id')
            ->whereColumn('post_likes.user_id', '!=', 'canela_liked.user_id')
            ->select('post_likes.post_id')
            ->selectRaw('COUNT(*) AS like_count')
            ->groupBy('post_likes.post_id');
    }

    private function selectFirstLikeDate(Builder $query): void
    {
        // Sem a coluna (curtidas de antes de 2021), vale a data da concessão.
        if ($this->capabilities->likeDates()) {
            $query->selectRaw('MIN('.$this->wrap('post_likes.created_at').') AS granted_at');
        }
    }

    private function scopeUsers(Builder $query, Scope $scope, string $column): void
    {
        if ($scope->userIds !== null) {
            $query->whereIn($column, $scope->userIds ?: [0]);
        }
    }

    private function scopePosts(Builder $query, Scope $scope, string $column): void
    {
        if ($scope->postIds !== null) {
            $query->whereIn($column, $scope->postIds ?: [0]);
        }
    }

    /**
     * A primeira postagem (por id) de cada usuário que passa no teste, lendo
     * em lotes. Quem já tem o emblema é pulado no SQL, para a carga completa
     * não reler o fórum inteiro.
     */
    private function firstPerUser(Badge $badge, Builder $query, callable $matches): array
    {
        $this->excludeGranted($query, $badge, 'posts.user_id');

        $found = [];

        $query->orderBy('posts.id')->chunk(self::CHUNK, function ($posts) use (&$found, $matches) {
            foreach ($posts as $post) {
                if (! isset($found[$post->user_id]) && $matches($post)) {
                    $found[$post->user_id] = [
                        'user_id' => (int) $post->user_id,
                        'post_id' => (int) $post->id,
                        'granted_at' => $post->created_at ? (string) $post->created_at : null,
                    ];
                }
            }
        });

        return array_values($found);
    }

    /**
     * Pula quem já tem o emblema — por subconsulta, e não por uma lista de
     * ids, que num fórum grande passaria do limite de parâmetros do banco.
     */
    private function excludeGranted(Builder $query, Badge $badge, string $userColumn): void
    {
        $query->whereNotExists(fn (Builder $granted) => $granted
            ->selectRaw('1')
            ->from('canela_user_badges')
            ->where('canela_user_badges.badge_id', $badge->id)
            ->whereColumn('canela_user_badges.user_id', $userColumn));
    }

    /** @return list<array{user_id: int, post_id: int|null, granted_at: string|null}> */
    private function collect(Builder $query): array
    {
        return array_values(array_filter(array_map(static fn (object $row) => [
            'user_id' => (int) $row->user_id,
            'post_id' => isset($row->post_id) ? (int) $row->post_id : null,
            'granted_at' => isset($row->granted_at) ? (string) $row->granted_at : null,
        ], $query->get()->all()), static fn (array $row) => $row['user_id'] > 0));
    }

    /** Nome de coluna com o prefixo e as aspas do banco, para expressões cruas. */
    private function wrap(string $column): string
    {
        return $this->db->getQueryGrammar()->wrap($column);
    }
}
