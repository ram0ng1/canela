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

namespace Ramon\Canela\Community\Api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Group\Group;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\AdminText;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\UserPresenter;

/**
 * GET /api/canela-about — tudo o que a página "Sobre" mostra numa resposta só:
 * o texto do admin, o contato, a equipe e as estatísticas do site.
 *
 * As estatísticas contam a tabela inteira de tópicos e postagens, então ficam
 * 30 minutos em cache (recalculadas de tempos em tempos).
 * Elas só contam o que um visitante veria — sem ocultos, privados nem tópicos
 * de tags restritas —, o que as torna iguais para todo mundo e permite um
 * cache único. A equipe não entra no
 * cache: depende de quem pergunta (grupos ocultos, usuários visíveis) e são
 * duas consultas pequenas.
 */
final class ShowAboutController implements RequestHandlerInterface
{
    public const CACHE_TTL = 1800;

    // `.v2`: as contagens antigas incluíam tópicos de tags restritas; a chave
    // nova evita servi-las por até 30 minutos depois da atualização.
    private const CACHE_KEY = 'canela.about.overview.v2';

    /** Mais que isso numa equipe vira lista de usuários, não página "Sobre". */
    private const STAFF_LIMIT = 100;

    public function __construct(
        private readonly Community $community,
        private readonly SettingsRepositoryInterface $settings,
        private readonly Cache $cache,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly AdminText $text,
        private readonly UserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::ABOUT_ENABLED);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        $admins = $this->staff($actor, Group::ADMINISTRATOR_ID);
        $moderators = $this->staff($actor, Group::MODERATOR_ID, exceptGroup: Group::ADMINISTRATOR_ID);
        $showStaff = $this->community->enabled(Community::ABOUT_SHOW_STAFF);

        $overview = $this->cache->remember(self::CACHE_KEY, self::CACHE_TTL, fn () => $this->overview());

        $included = [];

        if ($showStaff) {
            foreach ([...$admins ?? [], ...$moderators ?? []] as $user) {
                $included[$user->id] ??= $this->presenter->one($user, $actor);
            }
        }

        return new JsonResponse([
            'aboutHtml' => $this->aboutHtml($request),
            'contactEmail' => $this->str(Community::ABOUT_CONTACT_EMAIL),
            'contactUrl' => $this->str(Community::ABOUT_CONTACT_URL),
            'members' => $overview['members'],
            'createdAt' => $overview['createdAt'],
            'adminCount' => $admins === null ? null : count($admins),
            'moderatorCount' => $moderators === null ? null : count($moderators),
            'admins' => $showStaff && $admins !== null ? array_map(fn (User $user) => (string) $user->id, $admins) : null,
            'moderators' => $showStaff && $moderators !== null ? array_map(fn (User $user) => (string) $user->id, $moderators) : null,
            'stats' => $this->community->enabled(Community::ABOUT_SHOW_STATS) ? $overview['stats'] : null,
            'cachedAt' => $overview['cachedAt'],
            'included' => array_values($included),
        ]);
    }

    /**
     * Os membros de um grupo da equipe que o ator pode ver, ou `null` quando o
     * grupo é oculto para ele — aí a seção some, em vez de aparecer vazia e
     * revelar que o grupo existe.
     *
     * @return list<User>|null
     */
    private function staff(User $actor, int $groupId, ?int $exceptGroup = null): ?array
    {
        if (! Group::query()->whereVisibleTo($actor)->whereKey($groupId)->exists()) {
            return null;
        }

        $query = User::query()
            ->whereVisibleTo($actor)
            ->whereIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId))
            ->with('groups')
            ->orderBy('users.username')
            ->limit(self::STAFF_LIMIT);

        if ($exceptGroup !== null) {
            $query->whereNotIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $exceptGroup));
        }

        return $query->get()->all();
    }

    /** O texto "sobre" do admin, em HTML (ver AdminText). */
    private function aboutHtml(ServerRequestInterface $request): ?string
    {
        return $this->text->render((string) $this->settings->get(Community::ABOUT_TEXT), $request);
    }

    /**
     * @return array{members: int, createdAt: string|null, cachedAt: string, stats: array<string, array<string, int|null>>}
     */
    private function overview(): array
    {
        $now = Carbon::now();
        $periods = [
            'day' => $now->copy()->subDay(),
            'week' => $now->copy()->subDays(7),
            'month' => $now->copy()->subDays(30),
            'all' => null,
        ];

        $stats = [
            'topics' => $this->countPeriods($periods, fn () => $this->publicDiscussions(), 'discussions.created_at'),
            'posts' => $this->countPeriods($periods, fn () => $this->publicPosts(), 'posts.created_at'),
            'users' => $this->countPeriods($periods, fn () => $this->members(), 'users.joined_at'),
            // "Usuários ativos" de sempre seria igual a "usuários": essa
            // célula fica vazia.
            'activeUsers' => $this->countPeriods($periods, fn () => $this->members(), 'users.last_seen_at', withTotal: false),
        ];

        if ($this->extensions->isEnabled('flarum-likes')) {
            $stats['likes'] = $this->countPeriods(
                $periods,
                fn () => $this->db->table('post_likes')->whereIn('post_likes.post_id', $this->publicPosts()->select('posts.id')),
                'post_likes.created_at'
            );
        }

        $createdAt = $this->members()->min('users.joined_at');

        return [
            'members' => $stats['users']['all'] ?? 0,
            'createdAt' => $createdAt ? Carbon::parse($createdAt)->toAtomString() : null,
            'cachedAt' => $now->toAtomString(),
            'stats' => $stats,
        ];
    }

    /**
     * @param array<string, Carbon|null> $periods
     * @param callable(): (Builder|QueryBuilder) $query
     * @return array<string, int|null>
     */
    private function countPeriods(array $periods, callable $query, string $column, bool $withTotal = true): array
    {
        $counts = [];

        foreach ($periods as $name => $since) {
            if ($since === null) {
                $counts[$name] = $withTotal ? $query()->count() : null;
                continue;
            }

            $counts[$name] = $query()->where($column, '>=', $since)->count();
        }

        return $counts;
    }

    /**
     * Os tópicos que um visitante vê: as regras de visibilidade do core e das
     * extensões (tags restritas, aprovação…) com o ator visitante: só conta o
     * que é público.
     */
    private function publicDiscussions(): Builder
    {
        // Os métodos que o Eloquent repassa ao query builder (whereNull,
        // whereIn…) alteram a mesma consulta; em instrução separada, a
        // variável continua um Builder do Eloquent também para a análise.
        $guest = new Guest();
        $guestsCanView = $guest->hasPermission('viewForum');

        $query = $guestsCanView ? Discussion::whereVisibleTo($guest) : Discussion::query();
        $query->where('discussions.is_private', false);
        $query->whereNull('discussions.hidden_at');

        if (! $guestsCanView && $this->extensions->isEnabled('flarum-tags')) {
            // Fórum fechado a visitantes: com o visitante tudo daria zero. Aí
            // vale o que não está em nenhuma tag com permissões próprias.
            $query->whereNotIn('discussions.id', fn (QueryBuilder $tagged) => $tagged
                ->select('discussion_tag.discussion_id')
                ->from('discussion_tag')
                ->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->where('tags.is_restricted', true));
        }

        return $query;
    }

    /** Respostas e primeiras postagens públicas, de tópicos públicos. */
    private function publicPosts(): Builder
    {
        $query = Post::query()
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false);

        $query->whereNull('posts.hidden_at')
            ->whereIn('posts.discussion_id', $this->publicDiscussions()->select('discussions.id'));

        return $query;
    }

    private function members(): Builder
    {
        return User::query()->where('users.is_email_confirmed', true);
    }

    private function str(string $key): ?string
    {
        $value = trim((string) $this->settings->get($key));

        return $value === '' ? null : $value;
    }
}
