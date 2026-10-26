<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Messages;

use PDO;

/**
 * As migrations `*_messages_*` do tema só agem se as tabelas do
 * flarum/messages já existem, mas ficam registradas como rodadas mesmo
 * quando não fizeram nada. No banco dos testes (compartilhado entre os
 * testes, com as migrations fora da transação), basta um teste ligar o tema
 * sem o flarum/messages para elas virarem no-op para sempre.
 *
 * Antes de subir o app, este passo apaga o registro delas quando as
 * colunas não existem — o `enable()` do flarum/testing as roda de novo, já
 * com as tabelas do flarum/messages — e limpa o cache do esquema do tema.
 */
trait RerunsMessagesMigrations
{
    protected function rerunMessagesMigrations(): void
    {
        $tmp = $this->tmpDir();
        $config = (include "$tmp/config.php")['database'];
        $prefix = $config['prefix'] ?? '';

        if ($config['driver'] === 'sqlite') {
            $path = str_starts_with($config['database'], '/') ? $config['database'] : "$tmp/{$config['database']}";
            $pdo = new PDO("sqlite:$path");
            $hasEvents = (bool) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '{$prefix}canela_dialog_events'")->fetchColumn();
            $hasDialogs = (bool) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '{$prefix}dialogs'")->fetchColumn();
        } else {
            $pdo = new PDO(
                sprintf('%s:host=%s;port=%s;dbname=%s', $config['driver'], $config['host'], $config['port'] ?? 3306, $config['database']),
                $config['username'],
                $config['password']
            );
            $exists = fn (string $table): bool => (bool) $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '$prefix$table'")->fetchColumn();
            $hasEvents = $exists('canela_dialog_events');
            $hasDialogs = $exists('dialogs');
        }

        // Sem o flarum/messages migrado, o próprio enable() dele roda tudo na ordem.
        if ($hasEvents || ! $hasDialogs) {
            return;
        }

        $delete = $pdo->prepare("DELETE FROM {$prefix}migrations WHERE extension = 'ramon-canela' AND migration = ?");

        foreach (glob(__DIR__.'/../../../../migrations/*.php') ?: [] as $file) {
            $name = basename($file, '.php');

            if (preg_match('/^\d{4}_\d{2}_\d{2}_\d{6}_messages_/', $name) === 1) {
                $delete->execute([$name]);
            }
        }

        // O SchemaCache do tema guarda o esquema pela contagem de migrations.
        if (is_dir("$tmp/storage/cache")) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator("$tmp/storage/cache", \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );

            foreach ($files as $file) {
                $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
            }
        }
    }
}
