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

/*
 * Os nomes dos campos traduzidos nos avisos de validação ("O campo título é
 * obrigatório", e não "O campo title"): ver ValidationAttributesServiceProvider.
 */

use Flarum\Extend;
use Ramon\Canela\Support\ValidationAttributesServiceProvider;

return [
    (new Extend\ServiceProvider())->register(ValidationAttributesServiceProvider::class),
];
