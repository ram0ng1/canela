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

namespace Ramon\Canela\UserSummary;

use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Links\LinkClicks;

/**
 * GET /api/canela-user-summary/{id} — as listas do Resumo do perfil do
 * Discourse (`user_summary`): com quem a pessoa mais conversa e onde.
 *
 * - `mostRepliedTo`: a quem ela mais respondeu (as citações do flarum/mentions
 *   fazem o papel do `reply_to_user_id`);
 * - `mostLikedBy`: quem mais curtiu as postagens dela;
 * - `mostLiked`: de quem ela mais curtiu;
 * - `topCategories`: as categorias (etiquetas primárias) com mais tópicos e
 *   respostas dela;
 * - `topLinks`: os links das postagens dela com mais cliques (recurso `links`;
 *   null com ele desligado).
 *
 * Tudo conta só postagens que quem pede pode ver (tópicos privados, etiquetas
 * restritas, postagens ocultas ficam de fora) e só mostra pessoas visíveis a
 * ele. Uma consulta que falhe esvazia só a própria lista: o perfil nunca
 * recebe um erro por causa do resumo.
 *
 * A resposta fica alguns minutos em cache por (pessoa, quem pergunta), como o
 * Discourse faz com o `user_summary` (lá, uma hora): o perfil pré-carrega o
 * resumo em toda visita, e são uma dúzia de agregações sobre as postagens.
 * Quem pergunta entra na chave, então ninguém recebe o que só outro veria; o
 * número de postagens e tópicos da pessoa também, para uma postagem nova dela
 * já aparecer.
 */
final class ShowUserSummaryController implements RequestHandlerInterface
{
    /** Quantos itens por lista, como no Discourse. */
    private const LIMIT = 6;

    /** Segundos de cache da resposta. */
    public const CACHE_TTL = 300;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly LinkClicks $links,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);

        /** @var User|null $user */
        $user = User::whereVisibleTo($actor)->find($id);

        if (! $user) {
            return new JsonResponse(['errors' => [['status' => '404', 'code' => 'not_found']]], 404);
        }

        $key = sprintf('canela.user-summary.%d.%d.%d.%d', $user->id, (int) $actor->id, (int) $user->comment_count, (int) $user->discussion_count);

        return new JsonResponse($this->cache->remember($key, self::CACHE_TTL, fn (): array => $this->summary($user, $actor)));
    }

    /** @return array<string, mixed> */
    private function summary(User $user, User $actor): array
    {
        // Os ids das postagens que o ator vê: a base de todas as contas.
        $visiblePosts = static fn (): Builder => Post::whereVisibleTo($actor)->select('posts.id')->toBase();

        $likes = $this->extensions->isEnabled('flarum-likes');
        $mentions = $this->extensions->isEnabled('flarum-mentions');
        $tags = $this->extensions->isEnabled('flarum-tags');

        // As três listas de pessoas buscam os usuários numa consulta só.
        $lists = [
            'mostRepliedTo' => $mentions ? $this->safely(fn (): Collection => $this->mostRepliedTo($user, $visiblePosts)) : null,
            'mostLikedBy' => $likes ? $this->safely(fn (): Collection => $this->mostLikedBy($user, $visiblePosts)) : null,
            'mostLiked' => $likes ? $this->safely(fn (): Collection => $this->mostLiked($user, $visiblePosts)) : null,
        ];
        $people = $this->safely(fn (): array => $this->users($lists, $actor));

        // Lista desligada continua null; se a busca dos usuários falhar, as ligadas ficam vazias.
        foreach ($lists as $name => $rows) {
            $people[$name] ??= $rows === null ? null : [];
        }

        return [
            'mostRepliedTo' => $people['mostRepliedTo'],
            'mostLikedBy' => $people['mostLikedBy'],
            'mostLiked' => $people['mostLiked'],
            'topCategories' => $tags ? $this->safely(fn (): array => $this->topCategories($user, $actor, $visiblePosts)) : null,
            'topLinks' => $this->links->enabled() ? $this->safely(fn (): array => $this->links->topForUser((int) $user->id, $visiblePosts(), self::LIMIT)) : null,
        ];
    }

    /**
     * @template T of array|Collection
     * @param callable(): T $build
     * @return T|array{}
     */
    private function safely(callable $build): array|Collection
    {
        try {
            return $build();
        } catch (\Throwable $error) {
            error_log('[ramon/canela] resumo do perfil: '.$error->getMessage());

            return [];
        }
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostRepliedTo(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_mentions_post as m')
            ->join('posts as mine', 'mine.id', '=', 'm.post_id')
            ->join('posts as target', 'target.id', '=', 'm.mentions_post_id')
            ->where('mine.user_id', $user->id)
            ->where('target.user_id', '<>', $user->id)
            ->whereNotNull('target.user_id')
            ->whereIn('mine.id', $visiblePosts())
            ->whereIn('target.id', $visiblePosts())
            ->groupBy('target.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('target.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostLikedBy(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_likes as l')
            ->join('posts as p', 'p.id', '=', 'l.post_id')
            ->where('p.user_id', $user->id)
            ->where('l.user_id', '<>', $user->id)
            ->whereIn('p.id', $visiblePosts())
            ->groupBy('l.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('l.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostLiked(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_likes as l')
            ->join('posts as p', 'p.id', '=', 'l.post_id')
            ->where('l.user_id', $user->id)
            ->where('p.user_id', '<>', $user->id)
            ->whereNotNull('p.user_id')
            ->whereIn('p.id', $visiblePosts())
            ->groupBy('p.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('p.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * As categorias com mais participação: tópicos que a pessoa abriu e
     * respostas (postagens depois da primeira) em cada etiqueta primária.
     *
     * @param callable(): Builder $visiblePosts
     * @return array<int, array<string, mixed>>
     */
    private function topCategories(User $user, User $actor, callable $visiblePosts): array
    {
        // A classe vem do flarum/tags: só existe com ele instalado.
        $tagClass = 'Flarum\\Tags\\Tag';

        if (! class_exists($tagClass)) {
            return [];
        }

        $visibleTags = $tagClass::whereVisibleTo($actor)->whereNotNull('position')->select('tags.id')->toBase();

        // `p.number` pela gramática: com prefixo de tabela o apelido muda.
        $number = $this->db->table('posts')->getGrammar()->wrap('p.number');

        $rows = $this->db->table('posts as p')
            ->join('discussion_tag as dt', 'dt.discussion_id', '=', 'p.discussion_id')
            ->where('p.user_id', $user->id)
            ->where('p.type', 'comment')
            ->whereIn('p.id', $visiblePosts())
            ->whereIn('dt.tag_id', $visibleTags)
            ->groupBy('dt.tag_id')
            ->select(
                'dt.tag_id as tag_id',
                $this->db->raw("SUM(CASE WHEN $number = 1 THEN 1 ELSE 0 END) as topics"),
                $this->db->raw("SUM(CASE WHEN $number > 1 THEN 1 ELSE 0 END) as replies"),
                $this->db->raw('COUNT(*) as total')
            )
            ->orderByDesc('total')
            ->limit(self::LIMIT)
            ->get();

        $tags = $tagClass::whereIn('id', $rows->pluck('tag_id')->all())->get()->keyBy('id');
        $result = [];

        foreach ($rows as $row) {
            $tag = $tags->get($row->tag_id);

            if (! $tag) {
                continue;
            }

            $result[] = [
                'id' => (string) $tag->id,
                'name' => (string) $tag->name,
                'slug' => (string) $tag->slug,
                'color' => $tag->color ?: null,
                'icon' => $tag->icon ?: null,
                'topics' => (int) $row->topics,
                'replies' => (int) $row->replies,
            ];
        }

        return $result;
    }

    /**
     * As pessoas de cada lista de linhas (user_id, total), só as que o ator
     * pode ver, com o que o fórum precisa para desenhar o avatar e o link.
     * Uma consulta para todas as listas.
     *
     * @param array<string, Collection<int, object>|array{}|null> $lists
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function users(array $lists, User $actor): array
    {
        $ids = [];

        foreach ($lists as $rows) {
            foreach ($rows ?? [] as $row) {
                $ids[(int) $row->user_id] = true;
            }
        }

        $users = $ids ? User::whereVisibleTo($actor)->whereIn('id', array_keys($ids))->get()->keyBy('id') : new Collection();
        $result = [];

        foreach ($lists as $name => $rows) {
            if ($rows === null) {
                continue;
            }

            $result[$name] = [];

            foreach ($rows as $row) {
                $other = $users->get((int) $row->user_id);

                if (! $other) {
                    continue;
                }

                $result[$name][] = [
                    'id' => (string) $other->id,
                    'username' => (string) $other->username,
                    'displayName' => (string) $other->display_name,
                    'avatarUrl' => $other->avatar_url,
                    'color' => $other->color ?? null,
                    'count' => (int) $row->total,
                ];

                if (count($result[$name]) >= self::LIMIT) {
                    break;
                }
            }
        }

        return $result;
    }
}
