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

namespace Ramon\Canela\Extras\History;

use Carbon\Carbon;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Flarum\Post\PostRepository;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Extras\Extras;

/**
 * `GET /api/canela/posts/{id}/revisions`: todas as versões de uma postagem,
 * da original à atual, para o modal "Histórico".
 *
 * - Só para quem pode ver a postagem: o repositório aplica a visibilidade do
 *   core (tópico, aprovação, postagem oculta…), e o que não se vê dá 404 — o
 *   mesmo que a API responde para a própria postagem.
 * - Postagem oculta: as datas e os autores das edições continuam, mas o texto
 *   de cada versão só vai para quem pode editá-la. Quem vê uma postagem oculta
 *   (moderação) sem poder editá-la não deveria ler o que foi apagado por meio
 *   das versões antigas.
 * - Histórico só para o autor e quem pode editar (opção do admin): para os
 *   demais, 404.
 * - Recurso desligado no admin: 404, como se a rota não existisse.
 */
final class ListRevisionsController implements RequestHandlerInterface
{
    public function __construct(
        private readonly PostRepository $posts,
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! Extras::enabled($this->settings, Extras::POST_HISTORY)) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $postId = (int) Arr::get($request->getQueryParams(), 'id');

        $post = $this->posts->findOrFail($postId, $actor);

        if (! $post instanceof CommentPost || ! Extras::canSeeHistory($this->settings, $actor, $post)) {
            throw new RouteNotFoundException();
        }

        $revisions = PostRevision::query()
            ->where('post_id', $post->id)
            ->with('user')
            ->orderBy('revision')
            ->get();

        $contentVisible = $post->hidden_at === null || $actor->can('edit', $post);

        $versions = [];

        // Versão 1: o texto guardado na primeira edição, escrito pelo autor
        // quando a postagem foi criada.
        $author = $post->user;
        $createdAt = $post->created_at;

        foreach ($revisions as $revision) {
            $versions[] = $this->version(count($versions) + 1, $author, $createdAt, $revision->content, $contentVisible);

            // A versão seguinte nasceu desta edição.
            $author = $revision->user;
            $createdAt = $revision->created_at;
        }

        // A versão atual, que mora na própria postagem.
        $versions[] = $this->version(count($versions) + 1, $author, $createdAt, (string) $post->content, $contentVisible);

        return new JsonResponse([
            'data' => [
                'postId' => (string) $post->id,
                'revisionCount' => $revisions->count(),
                'contentHidden' => ! $contentVisible,
                'versions' => $versions,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function version(int $number, ?User $user, ?Carbon $createdAt, string $content, bool $contentVisible): array
    {
        return [
            'number' => $number,
            'createdAt' => $createdAt?->toAtomString(),
            'user' => $user ? [
                'id' => (string) $user->id,
                'username' => $user->username,
                'displayName' => $user->display_name,
                'avatarUrl' => $user->avatar_url,
            ] : null,
            'content' => $contentVisible ? $content : null,
        ];
    }
}
