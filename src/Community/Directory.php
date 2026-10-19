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

namespace Ramon\Canela\Community;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Ramon\Canela\Support\NullOrder;
use Ramon\Canela\Support\SchemaCache;

/**
 * A consulta do diretório de usuários (/u) e da lista de membros de um grupo
 * (/g/:nome): cada usuário com o que fez no período escolhido.
 *
 * O Discourse guarda uma tabela pronta (`directory_items`) recalculada a cada
 * hora; aqui cada coluna é uma subconsulta agrupada por usuário, ligada com
 * LEFT JOIN, para a ordenação e a paginação acontecerem no banco. Só contam
 * tópicos e respostas públicos — sem ocultos nem privados —, o mesmo que o
 * Discourse conta.
 */
final class Directory
{
    public const PAGE_SIZE = 50;

    /** Período do Discourse => dias para trás (`null` = desde sempre). */
    public const PERIODS = [
        'all' => null,
        'yearly' => 365,
        'quarterly' => 90,
        'monthly' => 30,
        'weekly' => 7,
        'daily' => 1,
    ];

    /** A tabela de visitas do recurso "stats" do tema, quando ele existe. */
    private const VISITS_TABLE = 'canela_user_visits';

    /** @var array{date: string, read: string|null}|false|null */
    private array|false|null $visitsSchema = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function hasLikes(): bool
    {
        return $this->extensions->isEnabled('flarum-likes');
    }

    /**
     * As colunas que existem neste fórum, na ordem do Discourse. O fórum usa a
     * lista para montar a tabela; ordenar por uma coluna fora dela é recusado.
     *
     * @return list<string>
     */
    public function columns(User $actor): array
    {
        $columns = [];

        if ($this->hasLikes()) {
            array_push($columns, 'likesReceived', 'likesGiven');
        }

        array_push($columns, 'topicCount', 'postCount');

        if ($visits = $this->visitsSchema()) {
            $columns[] = 'daysVisited';

            if ($visits['read'] !== null) {
                $columns[] = 'postsRead';
            }
        }

        // A ordenação por "último acesso" vazaria a ordem de quem esconde que
        // está online — o core só a permite com a mesma permissão.
        if ($this->canSortByLastSeen($actor)) {
            $columns[] = 'lastSeenAt';
        }

        return $columns;
    }

    public function canSortByLastSeen(User $actor): bool
    {
        return $actor->hasPermission('user.viewLastSeenAt');
    }

    public function defaultOrder(): string
    {
        return $this->hasLikes() ? 'likesReceived' : 'postCount';
    }

    /**
     * @return array{users: list<User>, total: int, hasMore: bool}
     */
    public function query(User $actor, string $period, string $order, bool $ascending, string $search, int $page, ?int $groupId): array
    {
        $since = self::PERIODS[$period] === null ? null : Carbon::now()->subDays(self::PERIODS[$period]);

        $users = User::query()
            ->whereVisibleTo($actor)
            ->where('users.is_email_confirmed', true);

        if ($groupId !== null) {
            $users->whereIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId));
        }

        if ($search !== '') {
            $this->applySearch($users, $search);
        }

        // O total sai antes dos JOINs: ele só depende dos filtros.
        $total = (clone $users)->toBase()->getCountForPagination();

        $users->select('users.*');

        $this->joinAggregate($users, 'topicCount', $this->topics($since));
        $this->joinAggregate($users, 'postCount', $this->replies($since));

        if ($this->hasLikes()) {
            $this->joinAggregate($users, 'likesReceived', $this->likesReceived($since));
            $this->joinAggregate($users, 'likesGiven', $this->likesGiven($since));
        }

        if ($visits = $this->visitsSchema()) {
            $this->joinAggregate($users, 'daysVisited', $this->visits($since, $visits['date'], null));

            if ($visits['read'] !== null) {
                $this->joinAggregate($users, 'postsRead', $this->visits($since, $visits['date'], $visits['read']));
            }
        }

        $direction = $ascending ? 'asc' : 'desc';

        match ($order) {
            'username' => $users->orderBy('users.username', $direction),
            'lastSeenAt' => NullOrder::orderBy($users, 'users.last_seen_at', $direction),
            'joinedAt' => NullOrder::orderBy($users, 'users.joined_at', $direction),
            default => $users->orderBy(self::alias($order), $direction),
        };

        $rows = $users
            ->orderBy('users.username')
            ->with('groups')
            ->offset(($page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE + 1)
            ->get()
            ->all();

        $hasMore = count($rows) > self::PAGE_SIZE;

        return [
            'users' => array_slice($rows, 0, self::PAGE_SIZE),
            'total' => $total,
            'hasMore' => $hasMore,
        ];
    }

    /**
     * Os números de um usuário que veio de `query()`.
     *
     * @return array<string, int>
     */
    public function stats(User $user): array
    {
        $stats = [];

        foreach (['topicCount', 'postCount', 'likesReceived', 'likesGiven', 'daysVisited', 'postsRead'] as $column) {
            $value = $user->getAttribute(self::alias($column));

            if ($value !== null) {
                $stats[$column] = (int) $value;
            }
        }

        return $stats;
    }

    /** Nome da coluna calculada no SELECT, sem colidir com as do `users`. */
    private static function alias(string $column): string
    {
        return 'canela_dir_'.strtolower((string) preg_replace('/[A-Z]/', '_$0', $column));
    }

    private function joinAggregate(Builder $users, string $column, QueryBuilder $aggregate): void
    {
        $table = 'cn_'.strtolower($column);
        $grammar = $users->getQuery()->getGrammar();

        $users
            ->leftJoinSub($aggregate, $table, "$table.user_id", '=', 'users.id')
            ->selectRaw('COALESCE('.$grammar->wrap("$table.aggregate").', 0) as '.$grammar->wrap(self::alias($column)));
    }

    private function applySearch(Builder $users, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';
        $hasNickname = resolve(SchemaCache::class)->hasColumn('users', 'nickname');

        $users->where(function (Builder $query) use ($like, $hasNickname) {
            $query->whereLike('users.username', $like, caseSensitive: false);

            // O fof/nicknames guarda o nome de exibição numa coluna própria.
            if ($hasNickname) {
                $query->orWhereLike('users.nickname', $like, caseSensitive: false);
            }
        });
    }

    private function topics(?Carbon $since): QueryBuilder
    {
        return $this->db->table('discussions')
            ->select('discussions.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->whereNotNull('discussions.user_id')
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false)
            ->when($since, fn (QueryBuilder $query) => $query->where('discussions.created_at', '>=', $since))
            ->groupBy('discussions.user_id');
    }

    /** "Respostas" no Discourse não contam a primeira postagem do tópico. */
    private function replies(?Carbon $since): QueryBuilder
    {
        return $this->publicPosts()
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->where('posts.number', '>', 1)
            ->when($since, fn (QueryBuilder $query) => $query->where('posts.created_at', '>=', $since))
            ->groupBy('posts.user_id');
    }

    private function likesReceived(?Carbon $since): QueryBuilder
    {
        return $this->publicPosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
            // Curtir a própria postagem (`flarum-likes.like_own_post`) não é
            // curtida recebida: o resumo do perfil e os níveis de confiança
            // já descontam, e o diretório mostrava um número maior.
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id')
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->when($since, fn (QueryBuilder $query) => $query->where('post_likes.created_at', '>=', $since))
            ->groupBy('posts.user_id');
    }

    private function likesGiven(?Carbon $since): QueryBuilder
    {
        return $this->db->table('post_likes')
            ->select('post_likes.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->when($since, fn (QueryBuilder $query) => $query->where('post_likes.created_at', '>=', $since))
            ->groupBy('post_likes.user_id');
    }

    /** Dias visitados (uma linha por dia) ou, com `$sumColumn`, a soma dela. */
    private function visits(?Carbon $since, string $dateColumn, ?string $sumColumn): QueryBuilder
    {
        $table = self::VISITS_TABLE;
        $query = $this->db->table($table)->select("$table.user_id");
        $grammar = $query->getGrammar();

        $sumColumn === null
            ? $query->selectRaw('COUNT(*) as aggregate')
            : $query->selectRaw('SUM('.$grammar->wrap("$table.$sumColumn").') as aggregate');

        return $query
            ->when($since, fn (QueryBuilder $q) => $q->where("$table.$dateColumn", '>=', $since->toDateString()))
            ->groupBy("$table.user_id");
    }

    private function publicPosts(): QueryBuilder
    {
        return $this->db->table('posts')
            ->whereNotNull('posts.user_id')
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false)
            ->whereIn('posts.discussion_id', fn (QueryBuilder $discussions) => $discussions
                ->select('id')
                ->from('discussions')
                ->whereNull('hidden_at')
                ->where('is_private', false));
    }

    /**
     * Descobre as colunas da tabela de visitas do recurso "stats" sem depender
     * dele: o diretório funciona sem a tabela e ganha as colunas quando ela
     * aparece.
     *
     * @return array{date: string, read: string|null}|null
     */
    private function visitsSchema(): ?array
    {
        if ($this->visitsSchema === null) {
            $this->visitsSchema = false;
            $columns = resolve(SchemaCache::class)->columns(self::VISITS_TABLE) ?? [];

            if (in_array('user_id', $columns, true)) {
                $date = array_values(array_intersect(['visited_at', 'visit_date', 'date', 'visited_on', 'created_at'], $columns))[0] ?? null;
                $read = array_values(array_intersect(['posts_read', 'read_count', 'posts_read_count'], $columns))[0] ?? null;

                if ($date !== null) {
                    $this->visitsSchema = ['date' => $date, 'read' => $read];
                }
            }
        }

        return $this->visitsSchema ?: null;
    }
}
