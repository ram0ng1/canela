<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Stats\Http\Visitor;

/**
 * Conta uma visualização de tópico com a regra do Discourse (ViewRule): uma
 * por pessoa e por dia, travada por N horas (`topic_view_duration_hours`).
 *
 * Como lá: recarregar a página ou voltar ao tópico logo depois não infla o
 * número; um dia novo, ou N horas depois no mesmo dia, conta de novo. Quem
 * entrou na conta é reconhecido pela conta (o IP dela não é guardado); o
 * visitante, pelo IP. Cada visualização contada soma no tópico e no dia
 * (TopicViewStats, o gráfico do mapa do tópico).
 */
final class TopicViewRecorder
{
    public const TABLE = 'canela_topic_views';

    /**
     * Uma requisição em cada tantas apaga as linhas vencidas de visitantes. É
     * a faxina mais barata possível: não precisa de agendador, e a tabela de
     * visitantes nunca guarda mais que uma janela de acessos.
     */
    private const PRUNE_ONE_IN = 50;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly StatsSettings $settings,
        private readonly TopicViewStats $stats
    ) {
    }

    /**
     * Devolve se a visualização foi contada, para quem chamou atualizar o
     * número que vai na resposta sem reler o banco.
     */
    public function record(Discussion $discussion, User $actor, ServerRequestInterface $request): bool
    {
        $visitor = new Visitor($request);

        if ($visitor->isCrawler()) {
            return false;
        }

        $now = Carbon::now();
        $hours = $this->settings->viewWindowHours();
        $windowStart = $now->copy()->subHours($hours);

        // O Discourse identifica o visitante só pelo IP (a chave do Redis é
        // `ip-<ip>`); aqui vai o hash com sal, para a tabela não guardar o IP.
        $identity = $actor->isGuest()
            ? ['user_id' => null, 'ip_hash' => $visitor->ipHash($this->settings->visitorSalt())]
            : ['user_id' => $actor->id, 'ip_hash' => null];

        $counted = $this->claim((int) $discussion->id, $identity, $now, $hours);

        if ($counted) {
            // Incremento no banco (e não `$discussion->save()`): duas pessoas
            // abrindo o tópico ao mesmo tempo não podem sobrescrever uma à outra.
            $this->db->table('discussions')->where('id', $discussion->id)->increment('canela_view_count');

            $discussion->setAttribute('canela_view_count', (int) ($discussion->getAttribute('canela_view_count') ?? 0) + 1);
            $discussion->syncOriginalAttribute('canela_view_count');

            $this->stats->add((int) $discussion->id, $now, ! $actor->isGuest());
        }

        // Uma linha de visitante vencida pela janela de horas não trava mais
        // nada (ViewRule conta de novo de qualquer jeito), então pode sumir.
        if ($actor->isGuest() && random_int(1, self::PRUNE_ONE_IN) === 1) {
            $this->db->table(self::TABLE)->whereNull('user_id')->where('viewed_at', '<', $windowStart)->delete();
        }

        return $counted;
    }

    /**
     * Reserva a visualização para esta pessoa. Cada passo é condicional para
     * que duas abas abertas ao mesmo tempo não contem duas vezes: só uma das
     * duas consegue inserir a linha ou avançar o `viewed_at` antigo — o mesmo
     * papel do SETNX do Redis no Discourse.
     *
     * A linha guarda a hora da última visualização CONTADA; a primeira linha
     * de cada pessoa é o "tópicos vistos" do perfil (o `topics_entered`).
     *
     * @param array{user_id: int|null, ip_hash: string|null} $identity
     */
    private function claim(int $discussionId, array $identity, Carbon $now, int $hours): bool
    {
        $query = fn () => $this->db->table(self::TABLE)
            ->where('discussion_id', $discussionId)
            ->when(
                $identity['user_id'] !== null,
                fn ($query) => $query->where('user_id', $identity['user_id']),
                fn ($query) => $query->whereNull('user_id')->where('ip_hash', $identity['ip_hash'])
            );

        $lastViewedAt = $query()->value('viewed_at');

        if ($lastViewedAt === null) {
            return $this->db->table(self::TABLE)->insertOrIgnore([
                'discussion_id' => $discussionId,
                'user_id' => $identity['user_id'],
                'ip_hash' => $identity['ip_hash'],
                'viewed_at' => $now,
            ]) > 0;
        }

        $last = Carbon::parse($lastViewedAt);

        if (! ViewRule::countsAgain($last, $now, $hours)) {
            return false;
        }

        // Só avança se a linha ainda tem o valor lido: a outra aba que chegou
        // junto encontra o `viewed_at` já trocado e não conta.
        return $query()->where('viewed_at', $last)->update(['viewed_at' => $now]) > 0;
    }
}
