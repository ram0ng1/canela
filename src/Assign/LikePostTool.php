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
use Ramon\Canela\Ai\Llm\ToolDefinition;
use Ramon\Canela\Ai\Tools\AiTool;
use Ramon\Canela\Ai\Tools\ToolOutput;
use Illuminate\Contracts\Events\Dispatcher;

/**
 * Curte uma postagem do tópico que o assistente está respondendo
 * (`like_post`). Só desse tópico, com a permissão de curtir e o
 * PostWasLiked de sempre (a notificação de curtida), como o botão.
 */
final class LikePostTool implements AiTool
{
    public const NAME = 'like_post';

    public function __construct(
        private readonly Discussion $discussion,
        private readonly Dispatcher $events,
    ) {
    }

    #[\Override]
    public function definition(): ToolDefinition
    {
        return new ToolDefinition(
            self::NAME,
            'Curte uma postagem deste tópico pelo número dela (o #N da conversa).',
            [
                'type' => 'object',
                'properties' => [
                    'number' => ['type' => 'integer', 'description' => 'O número da postagem no tópico.'],
                ],
                'required' => ['number'],
                'additionalProperties' => false,
            ]
        );
    }

    #[\Override]
    public function run(array $input, User $actor): ToolOutput
    {
        $number = (int) ($input['number'] ?? 0);
        $post = $this->discussion->comments()->where('number', $number)->whereNull('hidden_at')->first();
        $error = $this->like($post, $actor);

        if ($error !== null) {
            return new ToolOutput(sprintf('A postagem #%d %s.', $number, $error), ['tool' => self::NAME, 'number' => $number], true);
        }

        return new ToolOutput(sprintf('Postagem #%d curtida.', $number), ['tool' => self::NAME, 'number' => $number]);
    }

    /**
     * Curte a postagem como o botão: só deste tópico, nunca as próprias e com
     * a permissão de curtir. Devolve por que não curtiu, ou null.
     */
    public function like(?Post $post, User $actor): ?string
    {
        if (! $post || (int) $post->discussion_id !== (int) $this->discussion->id || $post->hidden_at !== null || $post->type !== 'comment') {
            return 'não existe neste tópico';
        }

        if ((int) $post->user_id === (int) $actor->id) {
            return 'é sua';
        }

        if (! $actor->can('like', $post)) {
            return 'não pode ser curtida (sem a permissão de curtir)';
        }

        // O mesmo que o `isLiked` do flarum/likes faz (o JsonApi::process não
        // carrega o modelo no update): grava e avisa com o PostWasLiked.
        if (! $post->likes()->where('user_id', $actor->id)->exists()) {
            $post->likes()->attach($actor->id);
            $this->events->dispatch(new PostWasLiked($post, $actor));
        }

        return null;
    }
}
