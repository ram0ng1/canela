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

namespace Ramon\Canela\Bookmarks\Console;

use Carbon\Carbon;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Post;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\Bookmarks\BookmarksFeature;
use Ramon\Canela\Bookmarks\Notification\BookmarkReminderBlueprint;

/**
 * Envia os lembretes de marcador vencidos (`php flarum canela:bookmarks:remind`).
 *
 * Roda sozinho pelo agendador do Flarum (`php flarum schedule:run` no cron),
 * a cada cinco minutos.
 */
final class SendBookmarkReminders extends Command
{
    /** @var string */
    protected $signature = 'canela:bookmarks:remind';

    /** @var string */
    protected $description = 'Envia as notificações dos lembretes de marcador que já venceram.';

    private const CHUNK = 100;

    public function handle(NotificationSyncer $notifications): int
    {
        if (! BookmarksFeature::enabled()) {
            $this->info('Marcadores desligados; nada a enviar.');

            return self::SUCCESS;
        }

        $sent = 0;
        $now = Carbon::now();

        Bookmark::query()
            ->whereNotNull('reminder_at')
            ->whereNull('reminded_at')
            ->where('reminder_at', '<=', $now)
            ->with(['user', 'post'])
            ->chunkById(self::CHUNK, function (Collection $bookmarks) use ($notifications, $now, &$sent) {
                /** @var Bookmark $bookmark */
                foreach ($bookmarks as $bookmark) {
                    // Marcado como enviado antes de enviar: um erro no envio de
                    // um lembrete não pode fazer o próximo ciclo repeti-lo para
                    // sempre (e o usuário ainda vê o marcador na lista).
                    $bookmark->reminded_at = $now;
                    $bookmark->save();

                    $user = $bookmark->user;

                    // O post pode ter sumido para ele (ocultado, tópico movido
                    // para uma categoria restrita): sem alerta para o invisível.
                    $post = $user ? Post::whereVisibleTo($user)->find($bookmark->post_id) : null;

                    if (! $user || ! $post) {
                        continue;
                    }

                    $notifications->sync(new BookmarkReminderBlueprint($bookmark, $post), [$user]);
                    $sent++;
                }
            });

        $this->info("Lembretes enviados: $sent.");

        return self::SUCCESS;
    }
}
