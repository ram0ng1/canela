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

namespace Ramon\Canela\Cooked\Formatter;

use s9e\TextFormatter\Configurator;

/**
 * O marcador do sumário: `[toc]` em qualquer lugar do primeiro post pede o
 * sumário na coluna da linha do tempo, (o Flarum não aceita HTML cru no
 * post, então o marcador é um BBCode). O marcador em si não
 * aparece: é um <div> vazio.
 */
final class TableOfContents
{
    public function __invoke(Configurator $config): void
    {
        if (isset($config->tags['TOC'])) {
            return;
        }

        $config->BBCodes->addCustom('[TOC]', '<div class="CanelaToc-marker" data-theme-toc="true"></div>');

        // Sem fechamento: [toc] e pronto.
        $config->tags['TOC']->rules->autoClose();
    }
}
