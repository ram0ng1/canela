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

namespace Ramon\Canela\Ai\Translation\Listener;

use Flarum\Discussion\Event\Renamed;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Illuminate\Contracts\Events\Dispatcher;
use Ramon\Canela\Ai\Translation\ContentTranslator;
use Ramon\Canela\Support\Log;
use Throwable;

/**
 * Editar a postagem (ou renomear o tópico) apaga as traduções dela: a próxima
 * leitura traduz o texto novo. O `source_hash` já esconderia a tradução velha;
 * apagar aqui só evita guardar o que nunca mais vai servir.
 */
final class ForgetTranslations
{
    public function __construct(
        private readonly ContentTranslator $translator,
    ) {
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Revised::class, function (Revised $event): void {
            $this->safely(function () use ($event): void {
                $this->translator->forgetPost($event->post);
                $this->translator->rememberLocale($event->post);
            });
        });
        // O idioma de cada postagem nova fica gravado na hora: a leitura do
        // tópico não detecta de novo a cada visita.
        $events->listen(Posted::class, function (Posted $event): void {
            $this->safely(fn () => $this->translator->rememberLocale($event->post));
        });

        $events->listen(Renamed::class, function (Renamed $event): void {
            $this->safely(fn () => $this->translator->forgetTitle((int) $event->discussion->id));
        });
    }

    /** Uma falha aqui (tabelas por criar) nunca pode impedir a edição. */
    private function safely(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $error) {
            Log::warning('traduções não apagadas: '.$error->getMessage());
        }
    }
}
