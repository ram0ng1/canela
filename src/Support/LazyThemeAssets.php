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

namespace Ramon\Canela\Support;

use Ernestdefoe\Wardrobe\ThemeAssets;
use Ernestdefoe\Wardrobe\ThemeRegistry;
use Ernestdefoe\Wardrobe\WarmThemeAssets;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Queue\SyncQueue;

/**
 * O Wardrobe sem peso na visita.
 *
 * O original recompila o tema dentro da requisição de quem abre o fórum
 * depois de qualquer mudança nos assets, e aquece todos os temas de uma vez
 * quando eles são recompilados. Num servidor pequeno isso estourava a memória
 * (erro 500) e deixava a primeira visita lenta. Aqui:
 *
 * - na visita, o tema que já tem arquivo é servido como está, mesmo que um
 *   pouco desatualizado, e a recompilação vai para a fila (o worker);
 * - só um tema que ainda não tem arquivo nenhum é compilado na hora (uma vez);
 * - no worker (CLI) e sem fila de verdade, vale o comportamento original.
 */
final class LazyThemeAssets extends ThemeAssets
{
    public function __construct(
        private readonly Container $app,
        ThemeRegistry $themes,
        SettingsRepositoryInterface $config,
        private readonly Cache $store
    ) {
        parent::__construct($app, $themes, $config, $store);
    }

    #[\Override]
    public function cssUrlFor(string $themeId): ?string
    {
        return $this->servedUrl($themeId, 'css') ?? parent::cssUrlFor($themeId);
    }

    #[\Override]
    public function jsUrlFor(string $themeId): ?string
    {
        return $this->servedUrl($themeId, 'js') ?? parent::jsUrlFor($themeId);
    }

    /**
     * A URL do arquivo já compilado, sem recompilar, pedindo à fila que o
     * atualize se ele estiver velho. Null quando o original deve decidir:
     * no CLI, sem worker (fila síncrona) ou se o tema ainda não tem arquivo.
     */
    private function servedUrl(string $themeId, string $type): ?string
    {
        if (PHP_SAPI === 'cli' || $this->queue() instanceof SyncQueue) {
            return null;
        }

        // Os membros do Wardrobe são privados: lidos no escopo dele.
        $peek = \Closure::bind(function (string $themeId, string $type): ?array {
            $compilers = $this->compilersFor($themeId);

            return $compilers === null ? null : [$compilers[$type]->getUrl(), $this->isStale($themeId)];
        }, $this, ThemeAssets::class);

        [$url, $stale] = $peek($themeId, $type) ?? [null, false];

        if ($url === null) {
            return null;
        }

        if ($stale) {
            $this->requestWarm();
        }

        return $url;
    }

    /** Uma recompilação na fila por minuto, no máximo, por mais visitas que cheguem. */
    private function requestWarm(): void
    {
        if ($this->store->add('canela.wardrobe.warm_requested', 1, 60)) {
            $this->queue()->push(new WarmThemeAssets());
        }
    }

    private function queue(): Queue
    {
        return $this->app->make(Queue::class);
    }
}
