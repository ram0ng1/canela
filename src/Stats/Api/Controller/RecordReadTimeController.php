<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api\Controller;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Stats\Http\Visitor;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\Validation\ReadTimeValidator;
use Ramon\Canela\Stats\VisitRecorder;

/**
 * POST /api/canela-read-time — o registro do tempo de leitura: a aba
 * do tópico manda, de tempos em tempos, quantos segundos a pessoa passou lendo
 * e quais postagens passaram pela tela.
 *
 * O navegador não é confiável, então o servidor só aceita o plausível:
 * - os segundos nunca passam do tempo real desde o último envio (duas abas
 *   abertas dividem o mesmo relógio em vez de somar) nem de um teto por envio;
 * - as postagens precisam ser do tópico informado e visíveis para quem envia,
 *   e cada uma conta uma vez por dia;
 * - o dia inteiro tem teto (VisitRecorder).
 *
 * Continua um controller, e não um endpoint do recurso de tópicos: o fórum
 * manda por `fetch` com `keepalive` (o último envio sai mesmo com a aba
 * fechando), um beacon que ninguém lê. O formato passa pelo
 * ReadTimeValidator; só quem entrou envia (401).
 */
final class RecordReadTimeController implements RequestHandlerInterface
{
    /** O front-end envia a cada 30 s; o dobro dá folga para atrasos da rede. */
    public const MAX_SECONDS_PER_CALL = 60;

    /** No primeiro envio não há relógio anterior para comparar. */
    private const FIRST_CALL_SECONDS = 35;

    /** Tolerância do relógio entre um envio e outro (latência, arredondamento). */
    private const CLOCK_SLACK_SECONDS = 5;

    private const MAX_POSTS_PER_CALL = 50;

    /** A trava do crédito por pessoa: o trabalho dentro dela leva milissegundos. */
    private const LOCK_SECONDS = 10;

    private const LOCK_WAIT_SECONDS = 3;

    /** Quantas postagens lidas hoje o cache lembra para não contar de novo. */
    private const MAX_REMEMBERED_POSTS = 2000;

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly VisitRecorder $visits,
        private readonly Cache $cache,
        private readonly ReadTimeValidator $validator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->activityEnabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = (array) $request->getParsedBody();
        $this->validator->assertValid([
            'discussionId' => Arr::get($body, 'discussionId'),
            'seconds' => Arr::get($body, 'seconds'),
            'postIds' => Arr::get($body, 'postIds'),
        ]);

        // findOrFail: um tópico que a pessoa não pode ver responde 404, como
        // se não existisse — o mesmo que a API faz no Show.
        $discussion = Discussion::query()->whereVisibleTo($actor)->findOrFail((int) Arr::get($body, 'discussionId'));

        [$seconds, $posts] = $this->locked((int) $actor->id, fn (): array => [
            $this->creditedSeconds((int) $actor->id, (int) Arr::get($body, 'seconds', 0)),
            $this->creditedPosts((int) $actor->id, $discussion, (array) Arr::get($body, 'postIds', []), $actor),
        ]);

        $this->visits->addReading($actor, $seconds, $posts, (new Visitor($request))->isMobile());

        return new EmptyResponse(204);
    }

    /**
     * O relógio e a lista de postagens do dia são ler-somar-gravar no cache:
     * duas abas enviando juntas leriam o mesmo relógio e as duas ganhariam o
     * crédito inteiro. Uma trava curta por pessoa enfileira os envios. Sem
     * trava disponível no cache, segue como antes; sem conseguir a trava a
     * tempo, o envio não credita nada — o próximo cobre o tempo, porque o
     * relógio só avança o que foi creditado.
     *
     * @param callable(): array{int, int} $credit
     * @return array{int, int}
     */
    private function locked(int $userId, callable $credit): array
    {
        $store = $this->cache->getStore();

        if (! $store instanceof LockProvider) {
            return $credit();
        }

        try {
            return $store->lock("canela.stats.read_lock.$userId", self::LOCK_SECONDS)->block(self::LOCK_WAIT_SECONDS, $credit);
        } catch (LockTimeoutException) {
            return [0, 0];
        }
    }

    private function creditedSeconds(int $userId, int $claimed): int
    {
        $now = Carbon::now()->getTimestamp();
        $key = "canela.stats.read_clock.$userId";
        $last = $this->cache->get($key);

        $allowed = is_int($last) ? max(0, $now - $last + self::CLOCK_SLACK_SECONDS) : self::FIRST_CALL_SECONDS;
        $credited = max(0, min($claimed, $allowed, self::MAX_SECONDS_PER_CALL));

        // O relógio avança exatamente o que foi creditado, e não até "agora":
        // assim a soma de tudo o que se credita nunca passa do tempo real desde
        // o primeiro envio (mais uma folga), por mais envios que cheguem. Sem
        // envios por uma hora, o relógio expira e recomeça.
        if ($credited > 0) {
            $this->cache->put($key, is_int($last) ? $last + $credited : $now, 3600);
        }

        return $credited;
    }

    /**
     * @param array<mixed> $postIds
     */
    private function creditedPosts(int $userId, Discussion $discussion, array $postIds, User $actor): int
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $postIds), fn (int $id) => $id > 0)));
        $ids = array_slice($ids, 0, self::MAX_POSTS_PER_CALL);

        if (! $ids) {
            return 0;
        }

        $key = "canela.stats.read_posts.$userId.".Carbon::now()->toDateString();
        $seen = (array) $this->cache->get($key, []);
        $ids = array_values(array_diff($ids, $seen));

        if (! $ids) {
            return 0;
        }

        $valid = Post::query()
            ->whereVisibleTo($actor)
            ->where('discussion_id', $discussion->id)
            ->where('type', 'comment')
            ->whereIn('id', $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($valid) {
            $remembered = array_slice(array_merge($seen, $valid), -self::MAX_REMEMBERED_POSTS);
            $this->cache->put($key, $remembered, Carbon::now()->endOfDay());
        }

        return count($valid);
    }
}
