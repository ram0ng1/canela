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

namespace Ramon\Canela\Ai\Tools;

use Flarum\Discussion\Discussion;
use Flarum\Post\CommentPost;
use Flarum\User\User;
use Ramon\Canela\Ai\Llm\ToolDefinition;

/**
 * Lê um tópico do fórum (`read_topic`), a ferramenta "Ler" do Discourse.
 *
 * Só o que o ator vê: o tópico pela visibilidade do core (o que não se vê
 * vira "não encontrado"), e os posts também filtrados por ele — um post
 * oculto ou à espera de aprovação não entra. Os posts vão em ordem, com autor
 * e número, cortados num teto para um tópico enorme não estourar o contexto.
 */
final class ReadTopicTool implements AiTool
{
    public const NAME = 'read_topic';

    private const MAX_POSTS = 30;

    private const MAX_CHARS = 24000;

    public function __construct(
        private readonly TopicLinks $links,
    ) {
    }

    #[\Override]
    public function definition(): ToolDefinition
    {
        return new ToolDefinition(
            self::NAME,
            'Lê uma discussão deste fórum pelo id (o id vem da busca): título, endereço e as postagens em ordem, com autor e número de cada uma. Use antes de responder com base numa discussão, para citar o que foi dito de fato.',
            [
                'type' => 'object',
                'properties' => [
                    'topic_id' => ['type' => 'integer', 'description' => 'O id da discussão.'],
                ],
                'required' => ['topic_id'],
                'additionalProperties' => false,
            ]
        );
    }

    #[\Override]
    public function run(array $input, User $actor): ToolOutput
    {
        $id = (int) ($input['topic_id'] ?? 0);
        $discussion = $id > 0 ? Discussion::query()->whereVisibleTo($actor)->find($id) : null;

        if (! $discussion instanceof Discussion) {
            return new ToolOutput(sprintf('Discussão %d não encontrada (ou sem permissão para vê-la).', $id), ['tool' => self::NAME, 'topic' => null], true);
        }

        $posts = $discussion->comments()
            ->whereVisibleTo($actor)
            ->with('user')
            ->orderBy('number')
            ->limit(self::MAX_POSTS)
            ->get();

        $url = $this->links->discussion($discussion);
        $text = sprintf("Discussão %d: \"%s\"\nEndereço: %s\n", $discussion->id, $discussion->title, $url);
        $used = mb_strlen($text);

        foreach ($posts as $post) {
            if (! $post instanceof CommentPost) {
                continue;
            }

            $author = $post->user?->display_name ?? '[excluído]';
            $entry = sprintf(
                "\n#%d %s (%s), %s:\n%s\n",
                $post->number,
                $author,
                $this->links->discussion($discussion, (int) $post->number),
                $post->created_at?->toDateString() ?? '',
                PostText::plain((string) $post->content)
            );

            if ($used + mb_strlen($entry) > self::MAX_CHARS) {
                $text .= "\n[… o restante da discussão foi cortado]";
                break;
            }

            $text .= $entry;
            $used += mb_strlen($entry);
        }

        return new ToolOutput($text, [
            'tool' => self::NAME,
            'topic' => ['id' => (string) $discussion->id, 'title' => $discussion->title, 'url' => $url],
        ]);
    }
}
