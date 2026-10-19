<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Expression;

/**
 * Os dias de visita e o tempo de leitura de cada pessoa (canela_user_visits).
 */
final class VisitRecorder
{
    public const TABLE = 'canela_user_visits';

    /** Teto diário — um dia tem 86 400 segundos, nenhuma conta lê mais que isso. */
    public const MAX_TIME_PER_DAY = 86400;

    /** Teto diário de postagens lidas; acima disso é script, não leitura. */
    public const MAX_POSTS_PER_DAY = 10000;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $cache
    ) {
    }

    /**
     * Marca o dia de hoje como visitado. Roda em toda requisição autenticada,
     * então o cache evita ir ao banco mais de uma vez por pessoa por dia.
     */
    public function touch(User $user, bool $mobile): void
    {
        $today = Carbon::now()->toDateString();
        $cacheKey = "canela.stats.visit.{$user->id}.{$today}";

        if ($this->cache->has($cacheKey)) {
            return;
        }

        $this->ensureDay($user, $today, $mobile);

        $this->cache->put($cacheKey, true, Carbon::now()->endOfDay());
    }

    /** Soma leitura ao dia de hoje, respeitando os tetos diários. */
    public function addReading(User $user, int $seconds, int $posts, bool $mobile): void
    {
        if ($seconds <= 0 && $posts <= 0) {
            return;
        }

        $today = Carbon::now()->toDateString();

        // Quase sempre a linha do dia já existe (a visita a criou): o UPDATE
        // vai direto, e ela só é criada quando ele não acha nada. Antes era um
        // INSERT ignorado e o UPDATE, a cada 30 s de cada leitor.
        if ($this->addToDay($user, $today, $seconds, $posts) === 0) {
            $this->ensureDay($user, $today, $mobile);
            $this->addToDay($user, $today, $seconds, $posts);
        }
    }

    /**
     * O teto no próprio UPDATE: vale mesmo com duas abas somando ao mesmo
     * tempo, o que um "lê, soma, grava" no PHP não garantiria. CASE em vez de
     * LEAST porque o SQLite, que o Flarum 2 também aceita, não tem LEAST.
     */
    private function addToDay(User $user, string $today, int $seconds, int $posts): int
    {
        return $this->db->table(self::TABLE)
            ->where('user_id', $user->id)
            ->where('visited_at', $today)
            ->update([
                'time_read' => $this->cappedSum('time_read', $seconds, self::MAX_TIME_PER_DAY),
                'posts_read' => $this->cappedSum('posts_read', $posts, self::MAX_POSTS_PER_DAY),
            ]);
    }

    private function cappedSum(string $column, int $amount, int $cap): Expression
    {
        $wrapped = $this->db->getQueryGrammar()->wrap($column);
        $amount = max(0, $amount);

        return $this->db->raw("CASE WHEN $wrapped + $amount > $cap THEN $cap ELSE $wrapped + $amount END");
    }

    private function ensureDay(User $user, string $day, bool $mobile): void
    {
        $this->db->table(self::TABLE)->insertOrIgnore([
            'user_id' => $user->id,
            'visited_at' => $day,
            'posts_read' => 0,
            'time_read' => 0,
            'mobile' => $mobile,
        ]);
    }
}
