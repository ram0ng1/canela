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

namespace Ramon\Canela\Messages\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Messages\Dialog;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Stats\ViewRule;

/**
 * `POST /api/dialogs/{id}/canela-view`: conta uma visualização da mensagem
 * quando a conversa é aberta — a coluna "Visualizações".
 *
 * Como as visualizações dos tópicos (recurso stats, ViewRule): uma por pessoa
 * por dia, travada por uma janela de horas (`canela.stats_view_window_hours`,
 * 8 por padrão). Só quem participa vê a conversa (o `{id}` passa pela visibilidade do recurso), então
 * não há visitante a contar; a janela fica no cache, com `add` atômico, sem
 * tabela própria. Sem a coluna (migration ainda não rodada) nada é contado.
 */
final class RecordDialogView
{
    private const DEFAULT_WINDOW_HOURS = 8;

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.view')
            ->route('POST', '/{id}/canela-view')
            ->authenticated()
            ->action(function (Context $context): array {
                /** @var Dialog $dialog */
                $dialog = $context->model;
                /** @var ConnectionInterface $db */
                $db = resolve(ConnectionInterface::class);

                if (! MessagesSchema::hasViews($db)) {
                    return ['counted' => false, 'viewCount' => null];
                }

                $hours = (int) resolve(SettingsRepositoryInterface::class)->get('canela.stats_view_window_hours', self::DEFAULT_WINDOW_HOURS);
                $hours = max(1, min(720, $hours ?: self::DEFAULT_WINDOW_HOURS));

                // A chave da trava (com a data): um dia novo conta de novo,
                // como nos tópicos (ViewRule), e não só depois das N horas.
                $key = ViewRule::cacheKey('dialog', (int) $dialog->id, Carbon::now(), (string) $context->getActor()->id);
                $counted = resolve(Cache::class)->add($key, 1, $hours * 3600);

                if ($counted) {
                    $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->increment(MessagesSchema::VIEWS_COLUMN);
                }

                $count = (int) $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->value(MessagesSchema::VIEWS_COLUMN);

                return ['counted' => (bool) $counted, 'viewCount' => $count];
            })
            ->response(fn (Context $context, array $result) => new JsonResponse($result));
    }
}
