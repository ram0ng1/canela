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
use Flarum\Post\CommentPost;
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
        $post = CommentPost::query()->where('discussion_id', $this->discussion->id)->where('number', $number)->whereNull('hidden_at')->first();
        $activity = ['tool' => self::NAME, 'number' => $number];

        if (! $post || (int) $post->user_id === (int) $actor->id) {
            return new ToolOutput(sprintf('A postagem #%d não existe neste tópico ou é sua.', $number), $activity, true);
        }

        if (! $actor->can('like', $post)) {
            return new ToolOutput(sprintf('Sem permissão para curtir a postagem #%d.', $number), $activity, true);
        }

        // O mesmo que o `isLiked` do flarum/likes faz (o JsonApi::process não
        // carrega o modelo no update): grava e avisa com o PostWasLiked.
        if (! $post->likes()->where('user_id', $actor->id)->exists()) {
            $post->likes()->attach($actor->id);
            $this->events->dispatch(new PostWasLiked($post, $actor));
        }

        return new ToolOutput(sprintf('Postagem #%d curtida.', $number), $activity);
    }
}
