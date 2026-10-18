<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api\Controller;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicCounter;

/**
 * GET /api/canela-counts — as contagens de "Novos" e "Não lidos" sem refazer o
 * documento inteiro do fórum. O front-end chama ao voltar para a lista, para o
 * "(N)" das abas acompanhar o que a pessoa acabou de ler.
 *
 * Com `?tag=slug`, conta só o que está na tag e nas filhas dela: na página de
 * uma categoria, as abas mostram os números dela, como no Discourse.
 */
final class ShowTopicCountsController implements RequestHandlerInterface
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly TopicCounter $counter,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->countsEnabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $tagIds = $this->tagIds((string) Arr::get($request->getQueryParams(), 'tag', ''));

        // Tag pedida mas inexistente: nada a contar ali.
        if ($tagIds === []) {
            return new JsonResponse(['new' => 0, 'unread' => 0, 'limit' => TopicCounter::LIMIT]);
        }

        return new JsonResponse([
            'new' => $this->counter->newCount($actor, $tagIds ?? []),
            'unread' => $this->counter->unreadCount($actor, $tagIds ?? []),
            'limit' => TopicCounter::LIMIT,
        ]);
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
