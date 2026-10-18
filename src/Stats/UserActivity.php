<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Os números do resumo do perfil do Discourse: dias visitados, tempo de
 * leitura (total e dos últimos 60 dias), postagens lidas, tópicos vistos e curtidas dadas/recebidas.
 *
 * Calculados de uma vez por usuário e guardados até o fim da requisição: o
 * recurso da API pede cada atributo separadamente, e sem a memória seriam
 * seis idas ao banco em vez de quatro.
 */
final class UserActivity
{
    /** O "tempo de leitura recente" do Discourse conta os últimos 60 dias. */
    public const RECENT_DAYS = 60;

    /** @var array<int, array<string, int|null>> */
    private array $memo = [];

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    public function get(User $user, string $stat): ?int
    {
        return $this->summary($user)[$stat] ?? null;
    }

    /**
     * @return array<string, int|null> curtidas valem null sem o flarum-likes,
     *                                 para o perfil esconder a estatística em vez de mostrar 0
     */
    public function summary(User $user): array
    {
        $id = (int) $user->id;

        if (isset($this->memo[$id])) {
            return $this->memo[$id];
        }

        $visits = $this->db->table(VisitRecorder::TABLE)
            ->where('user_id', $id)
            ->selectRaw('COUNT(*) AS days, COALESCE(SUM(time_read), 0) AS time_read, COALESCE(SUM(posts_read), 0) AS posts_read')
            ->first();

        // A tabela já é por dia: o recente é a mesma soma com a data de corte.
        $recent = $this->db->table(VisitRecorder::TABLE)
            ->where('user_id', $id)
            ->where('visited_at', '>=', Carbon::now()->subDays(self::RECENT_DAYS)->toDateString())
            ->sum('time_read');

        $summary = [
            'daysVisited' => (int) ($visits->days ?? 0),
            'timeRead' => (int) ($visits->time_read ?? 0),
            'recentTimeRead' => (int) $recent,
            'postsRead' => (int) ($visits->posts_read ?? 0),
            // Uma linha por (tópico, usuário) em canela_topic_views: COUNT já é "distintos".
            'topicsViewed' => $this->db->table(TopicViewRecorder::TABLE)->where('user_id', $id)->count(),
            'likesGiven' => null,
            'likesReceived' => null,
        ];

        if ($this->extensions->isEnabled('flarum-likes')) {
            $summary['likesGiven'] = $this->db->table('post_likes')->where('user_id', $id)->count();
            $summary['likesReceived'] = $this->db->table('post_likes')
                ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                ->where('posts.user_id', $id)
                // Curtir a própria postagem não é reconhecimento de ninguém.
                ->where('post_likes.user_id', '!=', $id)
                ->count();
        }

        return $this->memo[$id] = $summary;
    }
}
