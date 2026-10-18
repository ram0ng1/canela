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
 * Pré-carregamento: os pedidos que uma página do tema faria logo depois do
 * boot já saem no HTML da primeira carga (ver `src/Preload/PreloadContent.php`).
 * Nenhuma tabela nova, nenhuma migration.
 */

use Flarum\Extend;
use Ramon\Canela\Preload\AdminOnlyForumAttributes;
use Ramon\Canela\Preload\PreBootShell;
use Ramon\Canela\Preload\PreloadContent;

return [
    // Prioridade baixa: roda depois do conteúdo da rota, que põe o usuário do perfil no `apiDocument`.
    (new Extend\Frontend('forum'))
        ->content(PreloadContent::class, -10)
        // A casca (classes do #app, encaixes do cabeçalho) antes da primeira pintura.
        ->content(PreBootShell::class)
        // O que só o painel lê sai do documento do fórum (ver a classe).
        ->content(AdminOnlyForumAttributes::class, AdminOnlyForumAttributes::PRIORITY),
];
