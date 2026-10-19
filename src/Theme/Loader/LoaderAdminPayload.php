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

namespace Ramon\Canela\Theme\Loader;

use Flarum\Frontend\Document;

/**
 * Os SVGs prontos vão para o payload do admin, para a prévia dos estilos no
 * card: assim eles têm uma fonte só (LoaderPresets), sem cópia no JS. No
 * fórum eles não entram no payload; lá o escolhido já está na folha de CSS.
 */
final class LoaderAdminPayload
{
    public function __invoke(Document $document): void
    {
        $document->payload['canelaLoaderPresets'] = LoaderPresets::SVG;
    }
}
