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

namespace Ramon\Canela\Theme\Logo;

use Flarum\Api\Controller\UploadLogoController;
use Flarum\Foundation\AbstractServiceProvider;

/**
 * A rota POST /api/logo do core resolve o controlador pelo container: trocá-lo
 * aqui faz o campo de logo padrão do Flarum aceitar SVG.
 */
final class SvgLogoServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(UploadLogoController::class, SvgLogoUploadController::class);
    }
}
