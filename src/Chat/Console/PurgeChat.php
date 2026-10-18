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

namespace Ramon\Canela\Chat\Console;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Console\Scheduling\Event;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Chat\Upload\ChatUploads;

/**
 * A limpeza diária do chat (`php flarum canela:chat:purge`), como os jobs de
 * retenção do Discourse:
 *
 * - mensagens mais velhas que a retenção do admin (uma para canais públicos e
 *   outra para MDs; 0 = guardar para sempre) saem de vez, com reações, fios e
 *   anexos;
 * - anexos enviados que nunca viraram mensagem, depois de um dia.
 *
 * Roda pelo agendador do Flarum (`php flarum schedule:run` no cron).
 */
final class PurgeChat extends Command
{
    private const CHUNK = 500;

    /** @var string */
    protected $signature = 'canela:chat:purge';

    /** @var string */
    protected $description = 'Apaga as mensagens de chat além da retenção e os anexos abandonados.';

    public static function schedule(Event $event): void
    {
        $event->daily()->withoutOverlapping();
    }

    public function handle(ChatSettings $settings, ChatService $service, ChatUploads $uploads): int
    {
        $removed = 0;

        foreach ([[Channel::TYPE_PUBLIC, ChatSettings::RETENTION_DAYS], [Channel::TYPE_DIRECT, ChatSettings::DM_RETENTION_DAYS]] as [$type, $key]) {
            $days = $settings->int($key);

            if ($days <= 0) {
                continue;
            }

            $before = Carbon::now()->subDays($days);
            $channelIds = Channel::query()->where('type', $type)->pluck('id')->all();

            Message::query()
                ->whereIn('channel_id', $channelIds ?: [0])
                ->where('created_at', '<', $before)
                ->select('id')
                ->chunkById(self::CHUNK, function ($messages) use ($service, &$removed) {
                    $ids = $messages->pluck('id')->all();

                    $service->purgeUploads($ids);
                    Thread::query()->whereIn('original_message_id', $ids)->delete();
                    Message::query()->whereIn('id', $ids)->delete();
                    $removed += count($ids);
                });

            // A última mensagem e as contagens de cada canal, depois do corte.
            foreach (Channel::query()->whereKey($channelIds ?: [0])->get() as $channel) {
                $channel->last_message_id = Message::query()->where('channel_id', $channel->id)->whereNull('deleted_at')->max('id');
                $channel->messages_count = Message::query()->where('channel_id', $channel->id)->whereNull('deleted_at')->count();
                $channel->save();
            }
        }

        $orphans = 0;

        // `whereNull`/`limit` alteram a mesma consulta (o Eloquent os repassa ao
        // query builder); separados, `$orphanUploads` segue um Builder de Upload.
        $orphanUploads = Upload::query()->where('created_at', '<', Carbon::now()->subDay());
        $orphanUploads->whereNull('message_id')->limit(5000);

        foreach ($orphanUploads->get() as $upload) {
            $uploads->deleteFile($upload);
            $upload->delete();
            $orphans++;
        }

        $this->info("Mensagens apagadas: $removed. Anexos abandonados: $orphans.");

        return self::SUCCESS;
    }
}
