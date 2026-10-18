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

namespace Ramon\Canela\Bookmarks\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\Bookmarks\BookmarksFeature;
use Tobyz\JsonApiServer\Context as OriginalContext;
use Tobyz\JsonApiServer\Pagination\OffsetPagination;
use Tobyz\JsonApiServer\Pagination\Pagination;

/**
 * `/api/bookmarks`: os marcadores do ator.
 *
 * - GET lista (filtros `q` e `reminder`, ordens `createdAt`, `updatedAt` e
 *   `reminderAt`), com o post, o tópico e o autor incluídos.
 * - POST marca um post; PATCH troca nome e lembrete; DELETE desmarca.
 *
 * O escopo já restringe tudo ao dono (ScopeBookmarkVisibility): o marcador de
 * outra pessoa responde 404, e não 403, para nem confirmar que ele existe.
 *
 * @extends AbstractDatabaseResource<Bookmark>
 */
final class BookmarkResource extends AbstractDatabaseResource
{
    /** Ordens aceitas => coluna. A lista fecha no id para a paginação não pular nem repetir. */
    private const SORT_COLUMNS = [
        'createdAt' => 'canela_bookmarks.created_at',
        'updatedAt' => 'canela_bookmarks.updated_at',
        'reminderAt' => 'canela_bookmarks.reminder_at',
    ];

    #[\Override]
    public function type(): string
    {
        return 'bookmarks';
    }

    #[\Override]
    public function model(): string
    {
        return Bookmark::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        // `before` roda depois de achar o modelo e antes de qualquer escrita:
        // com o recurso desligado, tudo responde 404.
        $assertEnabled = static fn () => BookmarksFeature::assertEnabled();

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post', 'post.discussion', 'post.user'])
                ->defaultSort('-createdAt')
                ->paginate(20, 50)
                // Sem um searcher, o core recusa qualquer `filter[...]`; os
                // filtros daqui são simples o bastante para morar no recurso.
                ->query(function (Builder $query, ?Pagination $pagination, Context $context, array $filters, ?array $sort): Context {
                    $this->applyFilters($query, $context->getActor(), $filters);
                    $this->applySort($query, $sort);

                    if ($pagination instanceof OffsetPagination) {
                        $pagination->apply($query);
                    }

                    return $context->withQuery($query);
                }),
            Endpoint\Show::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post', 'post.discussion']),
            Endpoint\Create::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before($assertEnabled)
                ->defaultInclude(['post']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before($assertEnabled),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('name')
                ->nullable()
                ->writable()
                ->maxLength(Bookmark::NAME_MAX_LENGTH)
                ->set(static fn (Bookmark $bookmark, ?string $value) => $bookmark->setName($value)),

            Schema\DateTime::make('reminderAt')
                ->nullable()
                ->writable()
                // Um lembrete no passado nunca seria enviado — e o Discourse
                // também só aceita horários à frente.
                ->rule('after:now')
                ->set(static fn (Bookmark $bookmark, ?\DateTimeInterface $value) => $bookmark->setReminder($value)),

            Schema\DateTime::make('remindedAt'),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('updatedAt'),

            Schema\Relationship\ToOne::make('post')
                ->type('posts')
                ->includable()
                ->requiredOnCreate()
                ->writableOnCreate(),
        ];
    }

    #[\Override]
    public function sorts(): array
    {
        return array_map(
            static fn (string $name) => SortColumn::make($name),
            array_keys(self::SORT_COLUMNS)
        );
    }

    /**
     * O dono do marcador é sempre quem marca. Marcar de novo o mesmo post
     * reaproveita o marcador existente (o índice único não deixa outro), com o
     * nome e o lembrete que vierem agora — um duplo clique não vira erro.
     */
    #[\Override]
    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Context $context */
        $actor = $context->getActor();

        $model->user_id = $actor->id;

        /** @var Bookmark|null $existing */
        $existing = Bookmark::query()
            ->where('user_id', $actor->id)
            ->where('post_id', $model->post_id)
            ->first();

        if (! $existing) {
            return $model;
        }

        if ($model->isDirty('name')) {
            $existing->name = $model->name;
        }

        if ($model->isDirty('reminder_at')) {
            $existing->setReminder($model->reminder_at);
        }

        return $existing;
    }

    /** @param Builder<Bookmark> $query */
    private function applyFilters(Builder $query, User $actor, array $filters): void
    {
        // Só o que o ator ainda enxerga: um post ocultado ou um tópico que
        // passou para uma categoria restrita sai da lista, sem apagar o marcador.
        $query->whereHas('post', static fn (Builder $posts) => $posts->whereVisibleTo($actor));

        $term = trim((string) ($filters['q'] ?? ''));

        if ($term !== '') {
            $like = '%'.addcslashes($term, '\\%_').'%';

            $query->where(static function (Builder $query) use ($like) {
                $query->where('canela_bookmarks.name', 'like', $like)
                    ->orWhereHas('post', static function (Builder $posts) use ($like) {
                        $posts->where('content', 'like', $like)
                            ->orWhereHas('discussion', static fn (Builder $discussions) => $discussions->where('title', 'like', $like));
                    });
            });
        }

        match ($filters['reminder'] ?? null) {
            'pending' => $query->whereNotNull('canela_bookmarks.reminder_at')->whereNull('canela_bookmarks.reminded_at'),
            'any' => $query->whereNotNull('canela_bookmarks.reminder_at'),
            'none' => $query->whereNull('canela_bookmarks.reminder_at'),
            default => null,
        };

        if (isset($filters['discussion'])) {
            $discussionId = (int) $filters['discussion'];

            $query->whereIn(
                'canela_bookmarks.post_id',
                Post::query()->select('id')->where('discussion_id', $discussionId)
            );
        }
    }

    /** @param Builder<Bookmark> $query */
    private function applySort(Builder $query, ?array $sort): void
    {
        $direction = 'desc';

        foreach ($sort ?? [] as $name => $direction) {
            if (isset(self::SORT_COLUMNS[$name])) {
                // Lembrete vazio vai para o fim nos dois sentidos: a ordem "por
                // lembrete" é para ver o próximo que vence.
                if ($name === 'reminderAt') {
                    $query->orderByRaw('CASE WHEN '.$query->getQuery()->getGrammar()->wrap('canela_bookmarks.reminder_at').' IS NULL THEN 1 ELSE 0 END');
                }

                $query->orderBy(self::SORT_COLUMNS[$name], $direction);
            }
        }

        $query->orderBy('canela_bookmarks.id', $direction);
    }
}
