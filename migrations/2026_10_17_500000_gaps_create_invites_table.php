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
 * Links de convite do Discourse: quem convida gera um link com validade e um
 * número máximo de usos; cada cadastro feito por ele conta um uso.
 *
 * O código é o que vai no link (único, imprevisível). Apagar quem convidou
 * apaga os convites dele: um link órfão não tem a quem avisar.
 */
return Migration::createTable(
    'canela_invites',
    function (Blueprint $table) {
        $table->increments('id');
        $table->string('code', 40)->unique();
        $table->unsignedInteger('user_id');
        $table->unsignedSmallInteger('max_redemptions')->default(1);
        $table->unsignedSmallInteger('redemption_count')->default(0);
        $table->dateTime('expires_at')->nullable();
        $table->timestamps();

        $table->index('user_id');
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
