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

namespace Ramon\Canela\Assign;

use Flarum\Discussion\Discussion;
use Flarum\Likes\Event\PostWasLiked;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;

/**
 * As curtidas que a IA escolheu na resposta (a linha "Curtir:"). Só
 * postagens deste tópico, nunca as do assistente, com a permissão de
 * curtir e o PostWasLiked de sempre (a notificação), como o botão.
 */
final class PostLiker
{
    /** A IA escolhe; isto só evita curtir o tópico inteiro. */
    private const MAX = 3;

    public function __construct(
        private readonly Discussion $discussion,
        private readonly Dispatcher $events,
    ) {
    }

    /**
     * Curte as postagens pelos números (#N) e devolve, para o log, as que
     * não deu para curtir e por quê.
     *
     * @param list<int> $numbers
     * @return list<string>
     */
    public function like(array $numbers, User $actor): array
    {
        $skipped = [];

        foreach (array_slice(array_unique($numbers), 0, self::MAX) as $number) {
            $post = $this->discussion->comments()->where('number', $number)->whereNull('hidden_at')->first();

            $why = match (true) {
                ! $post instanceof Post => 'não existe',
                (int) $post->user_id === (int) $actor->id => 'é do assistente',
                ! $actor->can('like', $post) => 'sem a permissão de curtir',
                default => null,
            };

            if ($why !== null) {
                $skipped[] = '#'.$number.' '.$why;

                continue;
            }

            // O mesmo que o `isLiked` do flarum/likes faz (o JsonApi::process
            // não carrega o modelo no update): grava e avisa com o PostWasLiked.
            if (! $post->likes()->where('user_id', $actor->id)->exists()) {
                $post->likes()->attach($actor->id);
                $this->events->dispatch(new PostWasLiked($post, $actor));
            }
        }

        return $skipped;
    }
}
