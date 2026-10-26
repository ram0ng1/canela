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
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Ramon\Canela\Support\NullOrder;
use Ramon\Canela\Support\SchemaCache;
use Ramon\Canela\System\SystemUser;

/**
 * A consulta do diretório de usuários (/u) e da lista de membros de um grupo
 * (/g/:nome): cada usuário com o que fez no período escolhido.
 *
 * Não há tabela pronta recalculada de tempos em tempos: cada coluna é uma
 * subconsulta agrupada por usuário, ligada com
 * LEFT JOIN, para a ordenação e a paginação acontecerem no banco. Só contam
 * tópicos e respostas públicos — sem ocultos nem privados.
 */
final class Directory
{
    public const PAGE_SIZE = 50;

    /** Período => dias para trás (`null` = desde sempre). */
    public const PERIODS = [
        'all' => null,
        'yearly' => 365,
        'quarterly' => 90,
        'monthly' => 30,
        'weekly' => 7,
        'daily' => 1,
    ];

    /**
     * Segundos que uma página do diretório fica guardada. As contas leem as
     * tabelas inteiras de postagens, curtidas e visitas: sem o cache, cada
     * página aberta (ou varrida por um robô) refaz tudo.
     */
    public const CACHE_TTL = 120;

    /** As colunas que dizem quando a pessoa passou por aqui. */
    private const PRESENCE = ['daysVisited', 'postsRead'];

    /** A tabela de visitas do recurso "stats" do tema, quando ele existe. */
    private const VISITS_TABLE = 'canela_user_visits';

    /** @var array{date: string, read: string|null}|false|null */
    private array|false|null $visitsSchema = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly Cache $cache,
    ) {
    }

    public function hasLikes(): bool
    {
        return $this->extensions->isEnabled('flarum-likes');
    }

    /**
     * As colunas que existem neste fórum, na ordem de exibição. O fórum usa a
     * lista para montar a tabela; ordenar por uma coluna fora dela é recusado.
     *
     * @return list<string>
     */
    public function columns(User $actor, string $period = 'all'): array
    {
        $columns = [];

        if ($this->hasLikes()) {
            array_push($columns, 'likesReceived', 'likesGiven');
        }

        array_push($columns, 'topicCount', 'postCount');

        if (($visits = $this->visitsSchema()) && $this->canSeeVisits($actor, $period)) {
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

    /**
     * As colunas pelas quais o ator pode ordenar. Dias visitados e postagens
     * lidas mudam a cada visita: ordenar por elas revelaria a posição de quem
     * esconde que está online mesmo com o número escondido na linha. Como o
     * core faz com `lastSeenAt` (e o fof/user-directory com as suas), só quem
     * pode ver o "último acesso" de todo mundo ordena por elas.
     *
     * @return list<string>
     */
    public function sortable(User $actor, string $period = 'all'): array
    {
        $columns = $this->columns($actor, $period);

        if (! $this->canSortByLastSeen($actor)) {
            $columns = array_values(array_diff($columns, self::PRESENCE));
        }

        return [...$columns, 'username', 'joinedAt'];
    }

    /**
     * A mesma regra do `lastSeenAt` do UserResource do core (e do resumo do
     * perfil, em Stats\Api\UserResourceFields): os números de presença de quem
     * esconde que está online só aparecem para a própria pessoa e para quem
     * pode ver o último acesso dela.
     */
    public function canSeePresenceOf(User $actor, User $user): bool
    {
        return (bool) $user->getPreference('discloseOnline')
            || ($actor->id !== null && (int) $actor->id === (int) $user->id)
            || $actor->can('viewLastSeenAt', $user);
    }

    /**
     * Dias visitados de hoje ou da semana dizem quem passou por aqui — o mesmo
     * que "último acesso", que quem esconde que está online não mostra. Nos
     * períodos curtos, as colunas de visita ficam com a mesma permissão.
     */
    public function canSeeVisits(User $actor, string $period): bool
    {
        $days = self::PERIODS[$period] ?? null;

        return $days === null || $days > 7 || $this->canSortByLastSeen($actor);
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
        // Guarda só os ids e os números; os usuários são lidos de novo, para o
        // resto da resposta ser do ator. A chave separa cada pessoa (outra
        // extensão pode esconder usuários de um ator só) e junta os visitantes,
        // que são quem mais repete as mesmas páginas.
        $key = 'canela.directory.'.md5((string) json_encode([
            $period, $order, $ascending, $search, $page, $groupId,
            $actor->isGuest() ? 'guest' : (int) $actor->id,
            $this->canSeeVisits($actor, $period),
        ]));

        /** @var array{ids: list<int>, stats: array<int, array<string, int|null>>, total: int, hasMore: bool} $cached */
        $cached = $this->cache->remember($key, self::CACHE_TTL, function () use ($actor, $period, $order, $ascending, $search, $page, $groupId): array {
            $result = $this->compute($actor, $period, $order, $ascending, $search, $page, $groupId);
            $stats = [];

            foreach ($result['users'] as $user) {
                $stats[(int) $user->id] = $this->stats($user);
            }

            return ['ids' => array_keys($stats), 'stats' => $stats, 'total' => $result['total'], 'hasMore' => $result['hasMore']];
        });

        $users = User::query()->with('groups')->whereIn('id', $cached['ids'])->get()->keyBy('id');
        $rows = [];

        foreach ($cached['ids'] as $id) {
            $user = $users->get($id);

            if (! $user instanceof User) {
                continue;
            }

            // O cache guarda os números de todos; a privacidade é aplicada a
            // cada leitura, para a preferência valer assim que muda.
            $hidePresence = ! $this->canSeePresenceOf($actor, $user);

            foreach ($cached['stats'][$id] ?? [] as $column => $value) {
                $user->setAttribute(self::alias($column), $hidePresence && in_array($column, self::PRESENCE, true) ? null : $value);
            }

            $rows[] = $user;
        }

        return ['users' => $rows, 'total' => $cached['total'], 'hasMore' => $cached['hasMore']];
    }

    /**
     * @return array{users: list<User>, total: int, hasMore: bool}
     */
    private function compute(User $actor, string $period, string $order, bool $ascending, string $search, int $page, ?int $groupId): array
    {
        $since = self::PERIODS[$period] === null ? null : Carbon::now()->subDays(self::PERIODS[$period]);

        $users = User::query()
            ->whereVisibleTo($actor)
            ->where('users.is_email_confirmed', true);

        // O usuário do sistema não é uma pessoa: fica fora da lista.
        if ($systemId = resolve(SystemUser::class)->id()) {
            $users->where('users.id', '!=', $systemId);
        }

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

        if (($visits = $this->visitsSchema()) && $this->canSeeVisits($actor, $period)) {
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
     * Os números de um usuário que veio de `query()`. Uma coluna escondida
     * pela privacidade vem como null (e não ausente): a linha mostra "—" em
     * vez de zero.
     *
     * @return array<string, int|null>
     */
    public function stats(User $user): array
    {
        $stats = [];
        $attributes = $user->getAttributes();

        foreach (['topicCount', 'postCount', 'likesReceived', 'likesGiven', 'daysVisited', 'postsRead'] as $column) {
            $alias = self::alias($column);

            if (! array_key_exists($alias, $attributes)) {
                continue;
            }

            $stats[$column] = $attributes[$alias] === null ? null : (int) $attributes[$alias];
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

    /** "Respostas" não contam a primeira postagem do tópico. */
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

    /**
     * A mesma visibilidade das curtidas recebidas (e das curtidas dadas do
     * resumo do perfil): só curtidas em postagens públicas de tópicos
     * públicos — a curtida num tópico privado não é da conta de ninguém.
     */
    private function likesGiven(?Carbon $since): QueryBuilder
    {
        return $this->publicPosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
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
