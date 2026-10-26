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
use Flarum\Frontend\Compiler\RevisionCompiler;
use Flarum\Frontend\Compiler\VersionerInterface;
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
 * - um tema que ainda não tem arquivo fica com o CSS/JS do core até o worker
 *   compilá-lo;
 * - no worker (CLI) e sem fila de verdade, vale o comportamento original.
 */
final class LazyThemeAssets extends ThemeAssets
{
    public function __construct(
        private readonly Container $app,
        ThemeRegistry $themes,
        SettingsRepositoryInterface $config,
        private readonly Cache $store,
        VersionerInterface $versioner
    ) {
        // O Wardrobe 1.1.4 passou a pedir o versionador; as versões anteriores
        // ignoram o argumento a mais.
        parent::__construct($app, $themes, $config, $store, $versioner);
    }

    #[\Override]
    public function cssUrlFor(string $themeId): ?string
    {
        return $this->inVisit() ? $this->servedUrl($themeId, 'css') : parent::cssUrlFor($themeId);
    }

    #[\Override]
    public function jsUrlFor(string $themeId): ?string
    {
        return $this->inVisit() ? $this->servedUrl($themeId, 'js') : parent::jsUrlFor($themeId);
    }

    /** Uma visita com worker de fila de verdade: aí a visita nunca compila. */
    private function inVisit(): bool
    {
        return PHP_SAPI !== 'cli' && ! $this->queue() instanceof SyncQueue;
    }

    /**
     * A URL do arquivo já compilado, sem compilar nada. Velho: serve assim
     * mesmo e pede à fila que o atualize. Ainda sem arquivo: devolve null (a
     * página fica com o forum.css/js do core por enquanto) e pede à fila que
     * o compile; compilar ali estourava a memória do PHP (erro 500).
     */
    private function servedUrl(string $themeId, string $type): ?string
    {
        // Os membros do Wardrobe e do compilador são protegidos: lidos no escopo deles.
        $peek = \Closure::bind(function (string $themeId, string $type): ?array {
            $compilers = $this->compilersFor($themeId);

            return $compilers === null ? null : [$compilers[$type], $this->isStale($themeId)];
        }, $this, ThemeAssets::class);

        [$compiler, $stale] = $peek($themeId, $type) ?? [null, false];

        if ($compiler === null) {
            return null;
        }

        $hasRevision = \Closure::bind(fn (): bool => (bool) $this->versioner->getRevision($this->filename), $compiler, RevisionCompiler::class);

        if (! $hasRevision()) {
            $this->requestWarm();

            return null;
        }

        if ($stale) {
            $this->requestWarm();
        }

        return $compiler->getUrl();
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

    /**
     * O worker da fila é um processo longo: a lista "já atualizado nesta
     * requisição" do Wardrobe (`fresh`) ficava preenchida para sempre nele, e
     * os aquecimentos seguintes não recompilavam nada (o tema servido ficava
     * velho até alguém rodar o aquecimento à mão). Cada aquecimento começa
     * com ela vazia e decide pelo carimbo de tempo, como numa requisição nova.
     */
    #[\Override]
    public function warmAll(?string $shared = null): void
    {
        \Closure::bind(function (): void {
            $this->fresh = [];
        }, $this, ThemeAssets::class)();

        parent::warmAll($shared);
    }
}
