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

namespace Ramon\Canela\Topic;

use Carbon\Carbon;
use Flarum\Api\Schema;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Avisos de post, como no Discourse: "primeira postagem de Fulano" e
 * "Fulano voltou: a última postagem foi há N meses".
 *
 * O aviso é decidido uma vez, quando o post é criado (Posted), e fica no
 * próprio post (`canela_notice` e `canela_notice_since`): a página do tópico
 * só lê duas colunas, sem consulta a mais por post. Desligar a chave esconde
 * os avisos já gravados.
 */
final class PostNotice
{
    public const ENABLED = 'canela.post_notices';
    public const MONTHS = 'canela.post_notice_months';

    public const FIRST = 'first';
    public const RETURNING = 'returning';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function handle(Posted $event): void
    {
        $post = $event->post;

        if (! $post->user_id || ! $this->settings->get(self::ENABLED)) {
            return;
        }

        $previous = CommentPost::query()
            ->where('user_id', $post->user_id)
            ->where('id', '<', $post->id)
            ->max('created_at');

        $months = max(1, (int) $this->settings->get(self::MONTHS));

        if ($previous === null) {
            $notice = self::FIRST;
        } elseif (Carbon::parse($previous)->lt(Carbon::now()->subMonths($months))) {
            $notice = self::RETURNING;
        } else {
            return;
        }

        // Direto na tabela: sem disparar de novo os eventos de salvar o post.
        Post::query()->whereKey($post->id)->update([
            'canela_notice' => $notice,
            'canela_notice_since' => $notice === self::RETURNING ? $previous : null,
        ]);
    }

    /** `canelaNotice` = `{type, since}`, ou null. */
    public function fields(): array
    {
        return [
            Schema\Attribute::make('canelaNotice')
                ->get(fn (Post $post) => $post->getAttribute('canela_notice') && $this->settings->get(self::ENABLED) ? [
                    'type' => $post->getAttribute('canela_notice'),
                    'since' => $post->getAttribute('canela_notice_since') ? Carbon::parse($post->getAttribute('canela_notice_since'))->toIso8601String() : null,
                ] : null),
        ];
    }
}
