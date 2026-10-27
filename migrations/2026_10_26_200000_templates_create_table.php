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
 * Os modelos do editor: o texto que preenche o composer de um tópico novo.
 *
 * - `kind` `text`: o texto entra no editor e quem escreve muda o que quiser;
 * - `kind` `form`: só os campos marcados com {{campo}} no texto são
 *   preenchidos, num formulário; o resto do texto sai como está. `fields`
 *   guarda, em JSON, o rótulo, o tipo, a dica e as opções de cada campo.
 * - `required`: onde o modelo vale, não há a opção de texto livre.
 * - `position`: a ordem no seletor e no painel.
 */
return Migration::createTable(
    'canela_templates',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->string('name', 100);
        $table->string('kind', 10)->default('text');
        $table->mediumText('body');
        $table->text('fields')->nullable();
        $table->boolean('required')->default(false);
        $table->integer('position')->default(0);
        $table->timestamps();

        $table->index(['position', 'name']);
    }
);
