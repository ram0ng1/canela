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

namespace Ramon\Canela\Preload;

use Flarum\Api\Client;
use Flarum\Extension\ExtensionManager;
use Flarum\Frontend\Document;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * Pré-carregamento na primeira carga, como o core faz com o `apiDocument`.
 *
 * Algumas telas do tema pedem dados logo depois do boot (o Resumo do perfil
 * faz seis pedidos; a página de notificações, a do Sobre e a de uma tag, um
 * cada). Aqui eles saem junto com o HTML, em `payload.canelaPreload`, para a
 * página já nascer completa — sem "carregando" e sem saltos de layout.
 *
 * Os pedidos são os mesmos que o JS faria, pela API interna e com o mesmo
 * ator: as permissões, os filtros e os campos das outras extensões valem do
 * mesmo jeito. Só a rota aberta pré-carrega, e cada pedido é limitado (até
 * 100 itens). Na navegação dentro do app (sem recarregar) nada disso existe e
 * o JS pede como sempre.
 */
final class PreloadContent
{
    public function __construct(
        private readonly Client $api,
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        try {
            $plan = $this->plan($document, $request);
        } catch (Throwable) {
            return;
        }

        $out = [];

        foreach ($plan as $entry) {
            [$path, $query] = $entry;
            // O terceiro item monta a resposta de outro jeito: a partir de uma já
            // pré-carregada, ou de um pedido mais barato que dá o mesmo resultado.
            $data = isset($entry[2])
                ? ($entry[2])($out, fn (string $otherPath, array $otherQuery): ?object => $this->fetch($request, $otherPath, $otherQuery))
                : $this->fetch($request, $path, $query);

            if ($data !== null) {
                $out[PreloadKey::make($path, $query)] = $data;
            }
        }

        if ($out) {
            $document->payload['canelaPreload'] = $out;
        }
    }

    /**
     * Os pedidos da rota aberta: [caminho na API, parâmetros, e opcionalmente
     * como montar a resposta sem fazer o pedido igual ao do JS].
     *
     * @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}>
     */
    private function plan(Document $document, ServerRequestInterface $request): array
    {
        $guest = RequestUtil::getActor($request)->isGuest();
        $params = $request->getQueryParams();

        $actor = RequestUtil::getActor($request);

        return match ($request->getAttribute('routeName')) {
            'user' => $this->userPlan($document, (string) ($params['filter'] ?? ''), $guest ? null : (string) $actor->id),
            // A lista do menu e da página; o contador já vem no usuário da sessão.
            'notifications' => $guest ? [] : [self::NOTIFICATIONS],
            // "Novos (N)" e "Não lidos (N)" da tag: as do fórum todo já vêm no fórum.
            'tag' => $guest || ! isset($params['slug']) ? [] : [['/canela-counts', ['tag' => (string) $params['slug']]]],
            'canela.about' => [['/canela-about', []]],
            // `GuidelinesPage` e `AboutExtraPage` (a mesma página de regras).
            'canela.guidelines', 'canela.faq' => [['/canela-guidelines', []]],
            'canela.about_page' => preg_match('/^(\d+)/', (string) ($params['page'] ?? ''), $match) ? [['/canela-about-pages/'.$match[1], []]] : [],
            // `CategoriesPage` → `app.tagList.load([...])`.
            'canela.categories' => $this->extensions->isEnabled('flarum-tags') ? [['/tags', ['include' => 'children,lastPostedDiscussion,parent']]] : [],
            'canela.users' => [$this->directoryRequest($params)],
            // Os emblemas (só os campos da grade, `LIST_FIELDS` do JS) e, para quem
            // está logado, quais a pessoa já ganhou (`loadOwnedBadgeIds()`).
            'canela.badges' => array_merge(
                [['/canela-badges', ['sort' => 'position', 'fields' => ['canela-badges' => self::BADGE_LIST_FIELDS]]]],
                $guest ? [] : [self::ownedBadges((string) $actor->id)]
            ),
            default => [],
        };
    }

    /** `NotificationListState`: a primeira página, sem limite (o padrão da API). */
    private const NOTIFICATIONS = ['/notifications', ['page' => ['offset' => 0]]];

    /** Os campos que a grade de /badges desenha (`LIST_FIELDS` em features/badges/utils.ts). */
    private const BADGE_LIST_FIELDS = 'slug,name,description,icon,imageUrl,type,grouping,grantCount';

    /** `loadOwnedBadgeIds()`: só a ligação de cada concessão com o emblema. */
    private static function ownedBadges(string $userId): array
    {
        return ['/canela-user-badges', [
            'filter' => ['user' => $userId],
            'page' => ['limit' => 100, 'total' => 0],
            'include' => 'badge',
            'fields' => ['canela-user-badges' => 'badge', 'canela-badges' => 'slug'],
        ]];
    }

    /** `loadUserBadges()`: até 100 concessões. */
    private static function userBadges(string $userId): array
    {
        return ['/canela-user-badges', ['filter' => ['user' => $userId], 'page' => ['limit' => 100, 'total' => 0]]];
    }

    /**
     * `UsersPage` → `DirectoryState`: período, ordem, direção e busca vêm do
     * endereço, como no JS.
     *
     * @param array<string, mixed> $params
     */
    private function directoryRequest(array $params): array
    {
        $period = (string) ($params['period'] ?? '');

        return ['/canela-directory', [
            'period' => in_array($period, ['all', 'yearly', 'quarterly', 'monthly', 'weekly', 'daily'], true) ? $period : 'all',
            'order' => is_string($params['order'] ?? null) ? $params['order'] : null,
            'dir' => ($params['dir'] ?? null) === 'asc' ? 'asc' : null,
            'q' => is_string($params['q'] ?? null) ? $params['q'] : null,
            'page' => 1,
        ]];
    }

    /** @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}> */
    private function userPlan(Document $document, string $filter, ?string $actorId): array
    {
        $user = $document->payload['apiDocument']->data ?? null;

        if (! is_object($user) || ($user->type ?? null) !== 'users') {
            return [];
        }

        $id = (string) $user->id;
        $slug = (string) ($user->attributes->slug ?? '');
        $username = (string) ($user->attributes->username ?? '');
        $comments = (int) ($user->attributes->commentCount ?? 0);

        $summaryOn = (bool) $this->settings->get('canela.user_summary', true);
        $summaryDefault = $summaryOn && $this->settings->get('canela.user_default_tab', 'summary') === 'summary';

        // `/u/:username` abre no Resumo quando ele é a aba padrão (o JS troca o endereço).
        if ($filter === 'summary' || ($filter === '' && $summaryDefault)) {
            return $summaryOn && $slug !== '' ? $this->summaryPlan($id, $slug, $username, $comments) : [];
        }

        $own = $actorId !== null && $actorId === $id;

        // Abas que só a própria pessoa vê.
        if ($filter === 'notifications') {
            return $own ? [self::NOTIFICATIONS] : [];
        }

        if ($filter === 'bookmarks') {
            $include = ['post', 'post.discussion', 'post.user'];
            if ($this->extensions->isEnabled('flarum-tags')) {
                $include[] = 'post.discussion.tags';
            }

            // `BookmarksUserPage`: sem busca, a primeira página de 20.
            return $own ? [['/canela-bookmarks', ['include' => implode(',', $include), 'page' => ['offset' => 0, 'limit' => 20]]]] : [];
        }

        if ($filter === 'badges') {
            return [self::userBadges($id)];
        }

        if ($filter === 'activity' || $filter === '' || $filter === 'posts') {
            // A lista de postagens do core (PostListState), com as tags que o tema acrescenta.
            $include = ['user', 'discussion'];
            if ($this->extensions->isEnabled('flarum-tags')) {
                $include[] = 'discussion.tags';
            }

            return [['/posts', [
                'include' => implode(',', $include),
                'filter' => ['type' => 'comment', 'author' => $slug],
                'sort' => '-createdAt',
                'page' => ['offset' => 0],
            ]]];
        }

        return [];
    }

    /** Campos dos posts da amostra de respostas e da "Última postagem" (UserSummaryPage, UserStats). */
    private const REPLY_POST_FIELDS = 'number,createdAt,likesCount,discussion';

    /**
     * Os pedidos do Resumo (`UserSummaryPage`, `UserStats`, emblemas), com os
     * mesmos parâmetros que o JS manda.
     *
     * @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}>
     */
    private function summaryPlan(string $id, string $slug, string $username, int $comments): array
    {
        $plan = [
            // Os `fields` (sparse fieldsets) são os mesmos do UserSummaryPage: só o que as listas desenham.
            ['/discussions', ['filter' => ['author' => $slug], 'sort' => '-commentCount', 'include' => 'firstPost', 'fields' => ['discussions' => 'title,slug,commentCount,createdAt,firstPost', 'posts' => 'likesCount'], 'page' => ['limit' => 20, 'total' => 0]]],
            ['/posts', ['filter' => ['author' => $slug, 'type' => 'comment'], 'sort' => '-createdAt', 'include' => 'discussion', 'fields' => ['posts' => self::REPLY_POST_FIELDS, 'discussions' => 'title,slug'], 'page' => ['limit' => 50, 'total' => 0]]],
            // Sem o recurso `usersummary` (ou `badges`) a rota não existe: 404, e fica de fora.
            ["/canela-user-summary/$id", []],
            self::userBadges($id),
        ];

        if ($comments > 0) {
            // "Última postagem" das estatísticas do cabeçalho: é a primeira da
            // amostra de respostas acima (mesmo filtro, mesma ordem).
            $sampleKey = PreloadKey::make($plan[1][0], $plan[1][1]);
            $plan[] = [
                '/posts',
                ['filter' => ['author' => $slug, 'type' => 'comment'], 'sort' => '-createdAt', 'fields' => ['posts' => self::REPLY_POST_FIELDS], 'page' => ['limit' => 1, 'total' => 0]],
                static function (array $out) use ($sampleKey): ?object {
                    $first = $out[$sampleKey]->data[0] ?? null;

                    return is_object($first) ? (object) ['data' => [$first]] : null;
                },
            ];
        }

        if ($this->extensions->isEnabled('flarum-likes')) {
            // Curtidas dadas: o JS só lê o total da página (`meta.page.total`).
            // O pedido dele traz uma postagem inteira, com as inclusões padrão e
            // o HTML do conteúdo (~25 ms aqui); o mesmo filtro sem atributos nem
            // inclusões dá o mesmo total. A postagem fica de fora: ninguém a lê.
            $plan[] = [
                '/posts',
                ['filter' => ['likedBy' => $username], 'page' => ['limit' => 1]],
                static function (array $out, callable $fetch) use ($username): ?object {
                    $data = $fetch('/posts', ['filter' => ['likedBy' => $username], 'fields' => ['posts' => 'number'], 'include' => '', 'page' => ['limit' => 1]]);

                    return isset($data->meta) ? (object) ['data' => [], 'meta' => $data->meta] : null;
                },
            ];
        }

        return $plan;
    }

    /** @param array<string, mixed> $query */
    private function fetch(ServerRequestInterface $request, string $path, array $query): ?object
    {
        try {
            $api = $this->api->withParentRequest($request)->withQueryParams($query);

            if ($path === '/notifications') {
                // A lista marca as notificações como vistas e salva o usuário. O ator
                // da requisição já passou pela serialização do fórum, e outras
                // extensões deixam atributos calculados nele (contagens de rascunhos,
                // de uploads) que o `save()` tentaria gravar como colunas: um modelo
                // limpo, do mesmo usuário, evita isso.
                $fresh = User::query()->find(RequestUtil::getActor($request)->id);

                if (! $fresh instanceof User) {
                    return null;
                }

                $api = $api->withActor($fresh);
            }

            $response = $api->get($path);

            if ($response->getStatusCode() !== 200) {
                return null;
            }

            // Objetos continuam objetos (`attributes: {}` não vira `[]`).
            $data = json_decode((string) $response->getBody(), false);

            return is_object($data) ? $data : null;
        } catch (Throwable) {
            return null;
        }
    }
}
