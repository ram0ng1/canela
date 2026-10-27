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

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Tools\TopicLinks;
use Ramon\Canela\Support\Dates;
use Ramon\Canela\Support\Log;
use Throwable;

/**
 * `GET /api/discussions/{id}/canela-related`: os tópicos semanticamente
 * relacionados, já filtrados pelo que a pessoa vê, com o que a tabela do fim
 * do tópico mostra (título, endereço, respostas, atividade e as tags).
 *
 * Um endpoint de ação no recurso de tópicos, como o `canela-views` das
 * estatísticas: o `{id}` passa pela busca do próprio recurso, com a
 * visibilidade de quem pede — um tópico que a pessoa não vê responde 404.
 * Com o recurso desligado (ou sem embeddings configurados), também 404.
 *
 * Uma falha da API de embeddings devolve a lista vazia: a seção some, e a
 * página do tópico nunca quebra por causa dela.
 */
final class RelatedTopicsEndpoint
{
    /** Pedidos por minuto por pessoa (ou IP): cada cache vazio compara o tópico com todos os outros. */
    private const PER_MINUTE = 30;

    public function __construct(
        private readonly AiGate $gate,
        private readonly RelatedTopics $related,
        private readonly TopicLinks $links,
        private readonly ExtensionManager $extensions,
        private readonly Cache $cache,
    ) {
    }

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.aiRelated')
            ->route('GET', '/{id}/canela-related')
            ->action(static fn (Context $context): array => resolve(self::class)->list($context))
            ->response(static fn (Context $context, array $data): JsonResponse => new JsonResponse(['data' => $data]));
    }

    /** @return list<array<string, mixed>> */
    public function list(Context $context): array
    {
        $this->gate->feature(AiSettings::RELATED);

        /** @var Discussion $discussion */
        $discussion = $context->model;
        $actor = $context->getActor();

        $who = $actor->isGuest() ? 'ip:'.sha1((string) $context->request->getAttribute('ipAddress')) : 'user:'.$actor->id;
        $key = 'canela.ai.related.rate.'.sha1($who).'.'.intdiv(time(), 60);
        $this->cache->add($key, 0, 120);

        if ((int) $this->cache->increment($key) > self::PER_MINUTE) {
            return [];
        }

        try {
            $ids = $this->related->related($discussion, $actor);
        } catch (Throwable $error) {
            Log::warning('tópicos relacionados: '.$error->getMessage());
            $ids = [];
        }

        if ($ids === []) {
            return [];
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
                'lastPostedAt' => Dates::atom($topic->last_posted_at ?? $topic->created_at),
                'tagIds' => $withTags ? $topic->tags->pluck('id')->map(static fn ($tagId): string => (string) $tagId)->all() : [],
            ];
        }

        return $data;
    }
}
