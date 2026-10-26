<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Os números do resumo do perfil: dias visitados, tempo de
 * leitura (total e dos últimos 60 dias), postagens lidas, tópicos vistos e curtidas dadas/recebidas.
 *
 * Calculados de uma vez por usuário e guardados até o fim da requisição: o
 * recurso da API pede cada atributo separadamente, e sem a memória seriam
 * seis idas ao banco em vez de quatro.
 */
final class UserActivity
{
    /** O "tempo de leitura recente" conta os últimos 60 dias. */
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

        // A tabela já é por dia: o recente é a mesma soma com a data de corte,
        // na mesma consulta.
        $visits = $this->db->table(VisitRecorder::TABLE)
            ->where('user_id', $id)
            ->selectRaw(
                'COUNT(*) AS days, COALESCE(SUM(time_read), 0) AS time_read, COALESCE(SUM(posts_read), 0) AS posts_read, '
                .'COALESCE(SUM(CASE WHEN visited_at >= ? THEN time_read ELSE 0 END), 0) AS recent_time_read',
                [Carbon::now()->subDays(self::RECENT_DAYS)->toDateString()]
            )
            ->first();

        $summary = [
            'daysVisited' => (int) ($visits->days ?? 0),
            'timeRead' => (int) ($visits->time_read ?? 0),
            'recentTimeRead' => (int) ($visits->recent_time_read ?? 0),
            'postsRead' => (int) ($visits->posts_read ?? 0),
            // Uma linha por (tópico, usuário) em canela_topic_views: COUNT já é "distintos".
            // Só tópicos públicos: o perfil é visto por todos, e contar tópicos
            // privados ou ocultos diria quantos a pessoa abriu fora da vista.
            'topicsViewed' => $this->db->table(TopicViewRecorder::TABLE.' as v')
                ->join('discussions as d', 'd.id', '=', 'v.discussion_id')
                ->where('v.user_id', $id)
                ->where('d.is_private', false)
                ->whereNull('d.hidden_at')
                ->count(),
            'likesGiven' => null,
            'likesReceived' => null,
        ];

        if ($this->extensions->isEnabled('flarum-likes')) {
            $summary['likesGiven'] = $this->db->table('post_likes')
                ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
                ->where('post_likes.user_id', $id)
                ->where('posts.is_private', false)
                ->whereNull('posts.hidden_at')
                ->where('discussions.is_private', false)
                ->whereNull('discussions.hidden_at')
                ->count();
            // Mesmos filtros das curtidas dadas: o perfil é visto por todos, e
            // contar curtidas em postagens ocultas/privadas ou em tópicos
            // privados revelaria o que acontece fora da vista.
            $summary['likesReceived'] = $this->db->table('post_likes')
                ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
                ->where('posts.user_id', $id)
                // Curtir a própria postagem não é reconhecimento de ninguém.
                ->where('post_likes.user_id', '!=', $id)
                ->where('posts.is_private', false)
                ->whereNull('posts.hidden_at')
                ->where('discussions.is_private', false)
                ->whereNull('discussions.hidden_at')
                ->count();
        }

        return $this->memo[$id] = $summary;
    }
}
