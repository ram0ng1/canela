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

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\Exception\RouteNotFoundException;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicCounter;
use Ramon\Canela\Stats\Validation\TopicCountsValidator;

/**
 * `GET /api/forums/canela-counts` — as contagens de "Novos" e "Não lidos" sem
 * refazer o documento inteiro do fórum. O front-end chama ao voltar para a
 * lista, para o "(N)" das abas acompanhar o que a pessoa acabou de ler.
 *
 * Um endpoint de ação no recurso do fórum: as do fórum todo já chegam como
 * campos dele (`canelaNewCount`, `canelaUnreadCount`, ForumResourceFields), e
 * isto as renova sem serializar o fórum de novo.
 *
 * Com `filter[tag]=slug`, conta só o que está na tag e nas filhas dela: na
 * página de uma categoria, as abas mostram os números dela. (O filtro vai em
 * `filter`, e não num `?tag=` solto: a API recusa parâmetros fora dos do
 * JSON:API.)
 *
 * Só para quem entrou (401); desligado no admin, 404.
 */
final class ShowTopicCounts
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly TopicCounter $counter,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly TopicCountsValidator $validator,
    ) {
    }

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.counts')
            ->route('GET', '/canela-counts')
            ->action(static fn (Context $context): array => resolve(self::class)->counts($context))
            ->response(static fn (Context $context, array $counts): JsonResponse => new JsonResponse($counts));
    }

    /** @return array{new: int, unread: int, limit: int} */
    public function counts(Context $context): array
    {
        if (! $this->settings->countsEnabled()) {
            throw new RouteNotFoundException();
        }

        $actor = $context->getActor();
        $actor->assertRegistered();

        $filter = $context->request->getQueryParams()['filter'] ?? [];
        $tag = is_array($filter) ? ($filter['tag'] ?? null) : null;

        $this->validator->assertValid(['tag' => $tag]);

        $tagIds = $this->tagIds((string) $tag);

        // Tag pedida mas inexistente: nada a contar ali.
        if ($tagIds === []) {
            return ['new' => 0, 'unread' => 0, 'limit' => TopicCounter::LIMIT];
        }

        return [
            'new' => $this->counter->newCount($actor, $tagIds ?? []),
            'unread' => $this->counter->unreadCount($actor, $tagIds ?? []),
            'limit' => TopicCounter::LIMIT,
        ];
    }

    /**
     * A tag e as filhas dela; null quando nenhuma tag foi pedida (conta tudo).
     *
     * @return int[]|null
     */
    private function tagIds(string $slug): ?array
    {
        if ($slug === '' || ! $this->extensions->isEnabled('flarum-tags')) {
            return null;
        }

        $id = $this->db->table('tags')->where('slug', $slug)->value('id');

        if ($id === null) {
            return [];
        }

        return $this->db->table('tags')
            ->where('id', $id)
            ->orWhere('parent_id', $id)
            ->pluck('id')
            ->map(fn ($tagId): int => (int) $tagId)
            ->all();
    }
}
