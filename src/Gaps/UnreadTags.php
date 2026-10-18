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

namespace Ramon\Canela\Gaps;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Quais categorias e etiquetas têm tópicos novos ou não lidos para quem
 * está vendo — o ponto ao lado da categoria na barra lateral do Discourse.
 *
 * Uma consulta só por requisição (as tags vêm todas juntas no documento do
 * fórum), e só olha as últimas duas semanas: um tópico antigo que a pessoa
 * nunca abriu não é "novidade".
 */
final class UnreadTags
{
    private const DAYS = 14;

    /** @var array<int, array<int, true>> */
    private array $cache = [];

    /** @return array<int, true> ids das tags com novidade (as mães entram junto das filhas) */
    public function for(User $actor): array
    {
        if ($actor->isGuest()) {
            return [];
        }

        return $this->cache[(int) $actor->id] ??= $this->compute($actor);
    }

    /** @return array<int, true> */
    private function compute(User $actor): array
    {
        $since = Carbon::now()->subDays(self::DAYS);

        foreach ([$actor->joined_at, $actor->marked_all_as_read_at] as $date) {
            if ($date && Carbon::parse($date)->greaterThan($since)) {
                $since = Carbon::parse($date);
            }
        }

        $ids = Discussion::query()
            ->whereVisibleTo($actor)
            ->where('discussions.is_private', false)
            ->whereNull('discussions.hidden_at')
            ->where('discussions.last_posted_at', '>', $since)
            ->where(fn ($query) => $query
                ->whereNotExists(fn (QueryBuilder $state) => $state
                    ->selectRaw('1')
                    ->from('discussion_user')
                    ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                    ->where('discussion_user.user_id', $actor->id))
                ->orWhereExists(fn (QueryBuilder $state) => $state
                    ->selectRaw('1')
                    ->from('discussion_user')
                    ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                    ->where('discussion_user.user_id', $actor->id)
                    ->where(fn (QueryBuilder $read) => $read
                        ->whereNull('discussion_user.last_read_post_number')
                        ->orWhereColumn('discussion_user.last_read_post_number', '<', 'discussions.last_post_number'))))
            ->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'discussions.id')
            ->distinct()
            ->limit(500)
            ->pluck('discussion_tag.tag_id');

        $result = [];

        foreach ($ids as $id) {
            $result[(int) $id] = true;
        }

        // A categoria mãe acende junto com a filha, como no Discourse.
        if ($result) {
            foreach (Tag::query()->whereIn('id', array_keys($result))->whereNotNull('parent_id')->pluck('parent_id') as $parent) {
                $result[(int) $parent] = true;
            }
        }

        return $result;
    }
}
