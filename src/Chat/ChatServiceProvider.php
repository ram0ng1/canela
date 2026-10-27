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

namespace Ramon\Canela\Chat;

use Flarum\Foundation\AbstractServiceProvider;

/**
 * Um ChatAccess só no processo: as policies, a montagem das respostas e o
 * serviço precisam ver os mesmos caches por ator (as participações que a
 * resposta já carregou em lote, as tags visíveis). Com uma instância para
 * cada um, cada policy consultaria de novo, uma vez por mensagem.
 */
final class ChatServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->singleton(ChatAccess::class);
    }
}
