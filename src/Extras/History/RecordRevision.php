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

namespace Ramon\Canela\Extras\History;

use Carbon\Carbon;
use Flarum\Post\Event\Revised;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Extras\Extras;

/**
 * Grava o texto anterior de cada postagem editada.
 *
 * O evento `Revised` traz `$oldContent` já como texto-fonte (o markdown que o
 * autor digitou), e é ele que o histórico compara — o que aparece na vista
 * "markdown" do histórico.
 *
 * Com o recurso desligado nada é gravado: o admin que desliga o histórico não
 * espera que o fórum siga guardando cópias das versões antigas.
 */
final class RecordRevision
{
    /** Tentativas quando outra edição da mesma postagem pega o mesmo número. */
    private const ATTEMPTS = 3;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function handle(Revised $event): void
    {
        if (! Extras::enabled($this->settings, Extras::POST_HISTORY)) {
            return;
        }

        $post = $event->post;

        for ($attempt = 1; ; $attempt++) {
            $last = (int) PostRevision::query()->where('post_id', $post->id)->max('revision');

            $revision = new PostRevision();
            $revision->post_id = $post->id;
            $revision->user_id = $event->actor->id;
            $revision->revision = $last + 1;
            $revision->content = $event->oldContent;
            // A hora da edição, igual ao `edited_at` que o core acabou de gravar.
            $revision->created_at = $post->edited_at ?? Carbon::now();

            try {
                // Numa transação própria (um SAVEPOINT, se a edição já abriu uma):
                // no PostgreSQL o erro do índice aborta a transação inteira, e a
                // nova tentativa (e o resto da edição) falharia junto.
                $revision->getConnection()->transaction(static fn () => $revision->save());

                return;
            } catch (UniqueConstraintViolationException $error) {
                // Duas edições ao mesmo tempo leram o mesmo último número e o
                // índice único (post_id, revision) barrou a segunda. As duas
                // versões existiram: esta vai para o número seguinte. Antes, a
                // segunda edição dava erro 500 com a postagem já salva.
                if ($attempt >= self::ATTEMPTS) {
                    $this->logger->warning("[canela] versão anterior da postagem {$post->id} não gravada: {$error->getMessage()}");

                    return;
                }
            }
        }
    }
}
