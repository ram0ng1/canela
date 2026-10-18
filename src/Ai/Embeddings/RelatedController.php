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

namespace Ramon\Canela\Ai\Embeddings;

use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Tools\TopicLinks;
use Throwable;

/**
 * `GET /api/canela/ai/related/{id}`: os tópicos semanticamente relacionados,
 * já filtrados pelo que a pessoa vê, com o que a tabela do fim do tópico
 * mostra (título, endereço, respostas, atividade e as tags).
 *
 * Uma falha da API de embeddings devolve a lista vazia: a seção some, e a
 * página do tópico nunca quebra por causa dela.
 */
final class RelatedController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AiGate $gate,
        private readonly RelatedTopics $related,
        private readonly TopicLinks $links,
        private readonly ExtensionManager $extensions,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::RELATED);

        $actor = RequestUtil::getActor($request);
        $discussion = Discussion::query()->whereVisibleTo($actor)->find(AiGate::routeId($request));

        if (! $discussion instanceof Discussion) {
            throw new RouteNotFoundException();
        }

        try {
            $ids = $this->related->related($discussion, $actor);
        } catch (Throwable $error) {
            error_log('[ramon/canela] tópicos relacionados: '.$error->getMessage());
            $ids = [];
        }

        if ($ids === []) {
            return new JsonResponse(['data' => []]);
        }

        // Os dados que a tabela mostra vão prontos: a API de tópicos do core
        // não filtra por lista de ids, e um pedido por tópico seria pior.
        $withTags = $this->extensions->isEnabled('flarum-tags');
        // As tags vêm numa consulta só, e não uma por tópico.
        $topics = Discussion::query()->whereIn('id', $ids)->with($withTags ? ['tags'] : [])->get()->keyBy('id');

        $data = [];

        foreach ($ids as $id) {
            $topic = $topics->get($id);

            if (! $topic instanceof Discussion) {
                continue;
            }

            $data[] = [
                'id' => (string) $topic->id,
                'title' => $topic->title,
                'url' => $this->links->discussion($topic),
                'replyCount' => max(0, (int) $topic->comment_count - 1),
                'lastPostedAt' => ($topic->last_posted_at ?? $topic->created_at)?->toAtomString(),
                'tagIds' => $withTags ? $topic->tags->pluck('id')->map(static fn ($tagId): string => (string) $tagId)->all() : [],
            ];
        }

        return new JsonResponse(['data' => $data]);
    }
}
