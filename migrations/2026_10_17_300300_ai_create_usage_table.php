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
 * Quanto cada pessoa usou da IA por dia: pedidos (o limite diário do admin)
 * e tokens (para o admin saber o custo). Uma linha por pessoa e dia, que o
 * contador atualiza no lugar.
 */
return Migration::createTable(
    'canela_ai_usage',
    function (Blueprint $table) {
        $table->unsignedInteger('user_id');
        $table->date('day');
        $table->unsignedInteger('requests')->default(0);
        $table->unsignedBigInteger('input_tokens')->default(0);
        $table->unsignedBigInteger('output_tokens')->default(0);

        $table->primary(['user_id', 'day']);

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
