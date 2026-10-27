<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

/*
 * Em que categorias e etiquetas cada modelo vale. Um modelo sem linha aqui
 * vale em qualquer tópico novo.
 *
 * `tag_id` sem chave estrangeira: a tabela `tags` só existe com o flarum/tags
 * instalado. A tag apagada sai daqui pelo ouvinte do evento dela
 * (Templates\Listener\PruneDeletedTag), não pelo banco.
 */
return Migration::createTable(
    'canela_template_tag',
    static function (Blueprint $table): void {
        $table->unsignedInteger('template_id');
        $table->unsignedInteger('tag_id');

        $table->primary(['template_id', 'tag_id']);
        $table->index('tag_id');

        $table->foreign('template_id')->references('id')->on('canela_templates')->cascadeOnDelete();
    }
);
