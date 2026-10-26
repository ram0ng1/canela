<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Ramon\Canela\Topic\MarkUnread;

/**
 * As contagens "Novos (N)" e "Não lidos (N)" para quem entrou.
 *
 * - **Novo**: criado depois do último "marcar tudo como lido" (ou do cadastro),
 *   dentro dos últimos N dias, por outra pessoa, e nunca aberto.
 * - **Não lido**: já aberto, mas com respostas depois da última lida.
 *
 * As duas param em {@see self::LIMIT}: o número só serve para o "(99+)" da aba,
 * e contar dezenas de milhares de tópicos de um fórum antigo a cada carga de
 * página seria caro à toa. Cada consulta busca no máximo LIMIT ids.
 */
final class TopicCounter
{
    public const LIMIT = 100;

    /** As contas ficam em cache por pessoa: a lista pede de novo a cada volta para ela. */
    private const CACHE_TTL = 60;

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly ExtensionManager $extensions,
        private readonly SettingsRepositoryInterface $repository,
        private readonly Cache $cache,
        private readonly ReadStateVersion $version,
    ) {
    }

    /**
     * @param int[] $tagIds só os tópicos destas tags (a página de uma categoria
     *                      conta só o que é dela)
     */
    public function newCount(User $actor, array $tagIds = []): int
    {
        return $this->counts($actor, $tagIds)['new'];
    }

    /**
     * @param int[] $tagIds
     */
    public function unreadCount(User $actor, array $tagIds = []): int
    {
        return $this->counts($actor, $tagIds)['unread'];
    }

    /** @var array<string, array{new: int, unread: int}> */
    private array $counted = [];

    /**
     * As duas contas numa consulta só (UNION ALL de duas buscas limitadas),
     * guardadas nesta instância: o fórum pede "novos" e "não lidos" em dois
     * atributos, e eram duas consultas com o escopo de visibilidade inteiro.
     *
     * @param int[] $tagIds
     * @return array{new: int, unread: int}
     */
    private function counts(User $actor, array $tagIds): array
    {
        if ($actor->isGuest()) {
            return ['new' => 0, 'unread' => 0];
        }

        $key = $actor->id.':'.implode(',', $tagIds);

        if (isset($this->counted[$key])) {
            return $this->counted[$key];
        }

        // A versão muda quando a pessoa lê, marca tudo como lido ou posta; a
        // data do "marcar tudo" e os grupos entram por garantia. Tópicos novos
        // dos outros aparecem quando o cache vence (um minuto).
        $cacheKey = 'canela.counts.'.$actor->id.'.'.md5(implode('|', [
            implode(',', $tagIds),
            $this->version->get((int) $actor->id),
            (string) $actor->marked_all_as_read_at,
            $actor->groups->pluck('id')->sort()->implode(','),
            $this->settings->newDays(),
        ]));

        return $this->counted[$key] = $this->cache->remember($cacheKey, self::CACHE_TTL, fn (): array => $this->query($actor, $tagIds));
    }

    /**
     * @param int[] $tagIds
     * @return array{new: int, unread: int}
     */
    private function query(User $actor, array $tagIds): array
    {
        $new = $this->baseQuery($actor, $tagIds);
        $this->constrainNew($new, $actor);
        $unread = $this->baseQuery($actor, $tagIds);
        $this->unreadByState($unread, $actor);

        // Cada parte com o próprio LIMIT (a gramática põe as partes entre parênteses).
        $part = static fn (Builder $query, string $kind): QueryBuilder => $query->toBase()
            ->select('discussions.id')
            ->selectRaw('? as canela_kind', [$kind])
            ->limit(self::LIMIT);

        $kinds = $part($new, 'new')->unionAll($part($unread, 'unread'))->pluck('canela_kind')->countBy()->all();

        return ['new' => (int) ($kinds['new'] ?? 0), 'unread' => (int) ($kinds['unread'] ?? 0)];
    }

    /**
     * A mesma regra de {@see self::constrainUnread()}, mas partindo do estado
     * de leitura da pessoa (discussion_user pelo user_id) em vez de um EXISTS
     * por tópico: o banco lê só os tópicos que ela já abriu, e não o fórum
     * inteiro até achar LIMIT não lidos. Numa subconsulta à parte, para os
     * escopos de visibilidade das extensões não verem colunas repetidas.
     */
    public function unreadByState(Builder $query, User $actor): void
    {
        $markUnread = $actor->marked_all_as_read_at && MarkUnread::ready($this->repository);

        $query->whereIn('discussions.id', fn (QueryBuilder $state) => $state
            ->select('canela_state.discussion_id')
            ->from('discussion_user as canela_state')
            ->join('discussions as canela_read', 'canela_read.id', '=', 'canela_state.discussion_id')
            ->where('canela_state.user_id', $actor->id)
            ->whereNotNull('canela_state.last_read_post_number')
            ->whereColumn('canela_state.last_read_post_number', '<', 'canela_read.last_post_number')
            ->when($actor->marked_all_as_read_at, fn (QueryBuilder $state, $markedAt) => $state->where(
                fn (QueryBuilder $state) => $state
                    ->where('canela_read.last_posted_at', '>', $markedAt)
                    ->when($markUnread, fn (QueryBuilder $state) => $state->orWhere('canela_state.'.MarkUnread::COLUMN, '>', $markedAt))
            )));
    }

    /**
     * "Novo": a mesma regra na contagem e no filtro `canelaNew` da lista, para
     * o "(N)" da aba bater com o que a aba mostra.
     */
    public function constrainNew(Builder $query, User $actor): void
    {
        $query
            ->where('discussions.created_at', '>', $this->newSince($actor))
            // Quem escreveu o tópico já o "leu"; o NULL é de autor apagado.
            ->where(fn (Builder $query) => $query->whereNull('discussions.user_id')->orWhere('discussions.user_id', '!=', $actor->id))
            ->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->whereNotNull('discussion_user.last_read_post_number'));
    }

    /**
     * "Não lido": já aberto, com respostas depois da última lida.
     * O filtro `unread` do core também conta o nunca aberto (que aqui é
     * "Novo"); por isso a lista usa `canelaUnread`, com esta mesma regra.
     */
    public function constrainUnread(Builder $query, User $actor): void
    {
        $query
            ->whereExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->whereNotNull('discussion_user.last_read_post_number')
                ->whereColumn('discussion_user.last_read_post_number', '<', 'discussions.last_post_number')
                // "Marcar tudo como lido" zera também o que já tinha sido
                // aberto — menos o que a pessoa marcou como não lido depois.
                ->when($actor->marked_all_as_read_at, fn (QueryBuilder $query, $markedAt) => $query->where(
                    fn (QueryBuilder $query) => $query
                        ->where('discussions.last_posted_at', '>', $markedAt)
                        ->when(
                            MarkUnread::ready($this->repository),
                            fn (QueryBuilder $query) => $query->orWhere('discussion_user.'.MarkUnread::COLUMN, '>', $markedAt)
                        )
                )));
    }

    /**
     * O que entra em qualquer das duas: o que a pessoa pode ver, menos
     * mensagens privadas (contadas à parte), tópicos ocultos e o
     * que ela mesma pediu para não ver — tópicos ignorados e as tags ocultas
     * da lista principal, como a lista "Todas" já faz.
     */
    /**
     * @param int[] $tagIds
     */
    private function baseQuery(User $actor, array $tagIds = []): Builder
    {
        $query = Discussion::query()
            ->whereVisibleTo($actor)
            ->where('discussions.is_private', false)
            ->whereNull('discussions.hidden_at');

        if ($tagIds && $this->extensions->isEnabled('flarum-tags')) {
            $query->whereExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_tag')
                ->whereColumn('discussion_tag.discussion_id', 'discussions.id')
                ->whereIn('discussion_tag.tag_id', $tagIds));
        }

        if ($this->extensions->isEnabled('flarum-subscriptions')) {
            $query->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->where('discussion_user.subscription', 'ignore'));
        }

        // Só na contagem geral: a página de uma tag (mesmo de uma tag oculta)
        // lista os tópicos dela sem esse corte, como o core faz quando há
        // filtro — senão a página da tag oculta mostraria sempre 0.
        if (! $tagIds && $this->extensions->isEnabled('flarum-tags')) {
            $query->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_tag')
                ->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->whereColumn('discussion_tag.discussion_id', 'discussions.id')
                ->where('tags.is_hidden', true));
        }

        return $query;
    }

    /** A data mais recente entre cadastro, "marcar tudo como lido" e o limite de idade. */
    private function newSince(User $actor): Carbon
    {
        $candidates = array_filter([
            $actor->joined_at ? Carbon::parse($actor->joined_at) : null,
            $actor->marked_all_as_read_at ? Carbon::parse($actor->marked_all_as_read_at) : null,
            $this->settings->newDays() > 0 ? Carbon::now()->subDays($this->settings->newDays()) : null,
        ]);

        return $candidates ? max($candidates) : Carbon::createFromTimestamp(0);
    }
}
