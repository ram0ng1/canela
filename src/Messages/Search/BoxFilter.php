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

namespace Ramon\Canela\Messages\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Illuminate\Database\Query\Builder;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * `filter[canelaBox]`: as caixas de mensagens do Discourse
 * (`TopicQuery::PrivateMessageLists`), sobre as conversas do flarum/messages.
 *
 * - `inbox` ("Últimos"): fora do arquivo e com mensagem de outra pessoa
 *   (`have_posts_from_others`) — uma conversa que só eu comecei e ninguém
 *   respondeu ainda não está na caixa de entrada, só em "Enviadas".
 * - `sent`: fora do arquivo e com mensagem minha.
 * - `new`: fora do arquivo e nunca aberta (`last_read_message_id = 0`).
 * - `unread`: fora do arquivo, já aberta e com mensagens depois da última lida.
 * - `archive`: arquivadas por mim.
 * - `group`: a caixa da equipe — as conversas em que estou pelo grupo
 *   (`canela_via_group`), que ficam fora das caixas pessoais acima.
 *
 * O arquivo é por pessoa (`dialog_user.canela_archived_at`). Sem a coluna
 * (migration ainda não rodada) nada está arquivado e o Arquivo fica vazio.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class BoxFilter implements FilterInterface
{
    public const KEY = 'canelaBox';

    public const BOXES = ['inbox', 'sent', 'new', 'unread', 'archive', 'group'];

    #[\Override]
    public function getFilterKey(): string
    {
        return self::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $box = is_array($value) ? (string) reset($value) : $value;
        $actorId = (int) $state->getActor()->id;
        $query = $state->getQuery();
        $hasArchive = MessagesSchema::hasArchive($query->getConnection());
        $hasGroups = MessagesSchema::hasGroups($query->getConnection());

        // Uma caixa desconhecida (ou negada, que não faz sentido aqui) não
        // filtra nada, em vez de derrubar a lista.
        if (! in_array($box, self::BOXES, true) || $negate) {
            return;
        }

        // A linha da pessoa na conversa, com as condições da caixa.
        $membership = static function (callable $conditions) use ($actorId): \Closure {
            return static function (Builder $sub) use ($actorId, $conditions): void {
                $sub->selectRaw('1')
                    ->from(MessagesSchema::STATE_TABLE.' as canela_box_state')
                    ->whereColumn('canela_box_state.dialog_id', 'dialogs.id')
                    ->where('canela_box_state.user_id', $actorId);

                $conditions($sub);
            };
        };

        // As caixas pessoais deixam de fora o que vejo só por ser da equipe.
        $notArchived = static function (Builder $sub) use ($hasArchive, $hasGroups): void {
            if ($hasArchive) {
                $sub->whereNull('canela_box_state.'.MessagesSchema::ARCHIVED_COLUMN);
            }

            if ($hasGroups) {
                $sub->where('canela_box_state.'.MessagesSchema::VIA_GROUP_COLUMN, false);
            }
        };

        // Existe mensagem de alguém (`$mine` = minha ou de outra pessoa).
        $messageBy = static function (bool $mine) use ($actorId): \Closure {
            return static function (Builder $sub) use ($actorId, $mine): void {
                $sub->selectRaw('1')
                    ->from('dialog_messages as canela_box_messages')
                    ->whereColumn('canela_box_messages.dialog_id', 'dialogs.id')
                    ->where('canela_box_messages.user_id', $mine ? '=' : '!=', $actorId);
            };
        };

        switch ($box) {
            case 'inbox':
                $query->whereExists($membership($notArchived))->whereExists($messageBy(false));
                break;

            case 'sent':
                $query->whereExists($membership($notArchived))->whereExists($messageBy(true));
                break;

            case 'new':
                $query->whereExists($membership(static function (Builder $sub) use ($notArchived): void {
                    $notArchived($sub);
                    $sub->where('canela_box_state.last_read_message_id', 0);
                }))->whereNotNull('dialogs.last_message_id');
                break;

            case 'unread':
                $query->whereExists($membership(static function (Builder $sub) use ($notArchived): void {
                    $notArchived($sub);
                    $sub->where('canela_box_state.last_read_message_id', '>', 0)
                        ->whereColumn('canela_box_state.last_read_message_id', '<', 'dialogs.last_message_id');
                }));
                break;

            case 'group':
                if (! $hasGroups) {
                    $query->whereRaw('1 = 0');
                    break;
                }

                $query->whereExists($membership(static function (Builder $sub) use ($hasArchive): void {
                    $sub->where('canela_box_state.'.MessagesSchema::VIA_GROUP_COLUMN, true);

                    if ($hasArchive) {
                        $sub->whereNull('canela_box_state.'.MessagesSchema::ARCHIVED_COLUMN);
                    }
                }));
                break;

            case 'archive':
                if (! $hasArchive) {
                    $query->whereRaw('1 = 0');
                    break;
                }

                $query->whereExists($membership(static function (Builder $sub): void {
                    $sub->whereNotNull('canela_box_state.'.MessagesSchema::ARCHIVED_COLUMN);
                }));
                break;
        }
    }
}
