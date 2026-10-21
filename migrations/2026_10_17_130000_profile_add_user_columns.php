<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Campos do perfil estendido direto na tabela `users`: são
 * um por usuário, lidos sempre junto com ele — uma tabela à parte custaria um
 * join em cada post serializado só para mostrar o emoji do status.
 *
 * As imagens guardam o nome do arquivo no disco `canela-covers` ou a URL
 * externa inteira (ProfileImageUploader distingue pelo `://`).
 */
$columns = [
    'canela_bio',
    'canela_location',
    'canela_website',
    'canela_title',
    'canela_status_emoji',
    'canela_status_text',
    'canela_status_until',
    'canela_cover_url',
    'canela_card_bg_url',
    'canela_birthday',
];

return [
    'up' => static function (Builder $schema): void {
        // Idempotente: uma migração interrompida no meio pode rodar de novo.
        $missing = static fn (string $column): bool => ! $schema->hasColumn('users', $column);

        $schema->table('users', static function (Blueprint $table) use ($missing): void {
            $missing('canela_bio') && $table->text('canela_bio')->nullable();
            $missing('canela_location') && $table->string('canela_location', 100)->nullable();
            $missing('canela_website') && $table->string('canela_website', 255)->nullable();
            $missing('canela_title') && $table->string('canela_title', 60)->nullable();
            // O emoji tem até 16 pontos de código (famílias, bandeiras de
            // regiões), daí a folga.
            $missing('canela_status_emoji') && $table->string('canela_status_emoji', 32)->nullable();
            $missing('canela_status_text') && $table->string('canela_status_text', 100)->nullable();
            $missing('canela_status_until') && $table->dateTime('canela_status_until')->nullable();
            $missing('canela_cover_url') && $table->string('canela_cover_url', 255)->nullable();
            $missing('canela_card_bg_url') && $table->string('canela_card_bg_url', 255)->nullable();
            $missing('canela_birthday') && $table->date('canela_birthday')->nullable();
        });
    },

    'down' => static function (Builder $schema) use ($columns): void {
        $existing = array_values(array_filter(
            $columns,
            static fn (string $column): bool => $schema->hasColumn('users', $column)
        ));

        if ($existing !== []) {
            $schema->table('users', static function (Blueprint $table) use ($existing): void {
                $table->dropColumn($existing);
            });
        }
    },
];
