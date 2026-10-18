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

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * As contagens das abas "Novo (n)" e "Não lidos (n)" das mensagens do
 * Discourse — e a soma das duas na "Caixa de entrada" e em "Minhas
 * mensagens". O `unreadDialogCount` do flarum/messages junta as duas e inclui
 * as arquivadas; o Discourse separa e deixa o arquivo de fora.
 *
 * Só para a própria pessoa, numa consulta só sobre a tabela de participação.
 *
 * Uma página inclui a pessoa em vários documentos (o fórum, o perfil, os
 * pré-carregados): a conta fica guardada por alguns segundos no processo, em
 * vez de repetir a mesma consulta em cada um. O prazo curto limita o atraso
 * num processo longo e numa escrita no meio da requisição.
 */
final class UserFields
{
    /** Segundos que a conta vale dentro do mesmo processo. */
    private const MEMO_SECONDS = 5;

    /** @var array<int, array{0: float, 1: array{new: int, unread: int, group: int}}> */
    private static array $memo = [];

    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    /**
     * @return array<int, Schema\Attribute>
     */
    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaDialogCounts')
                ->visible(fn (User $user, Context $context): bool => $context->getActor()->is($user))
                ->get(function (User $user): array {
                    [$at, $counts] = self::$memo[(int) $user->id] ?? [0.0, null];

                    if ($counts !== null && microtime(true) - $at < self::MEMO_SECONDS) {
                        return $counts;
                    }

                    $counts = $this->count($user);
                    self::$memo[(int) $user->id] = [microtime(true), $counts];

                    return $counts;
                }),
        ];
    }

    /** @return array{new: int, unread: int, group: int} */
    private function count(User $user): array
    {
        $query = $this->db->table(MessagesSchema::STATE_TABLE.' as canela_count_state')
            ->join(MessagesSchema::DIALOG_TABLE.' as canela_count_dialogs', 'canela_count_dialogs.id', '=', 'canela_count_state.dialog_id')
            ->where('canela_count_state.user_id', $user->id)
            ->whereNotNull('canela_count_dialogs.last_message_id')
            ->whereColumn('canela_count_state.last_read_message_id', '<', 'canela_count_dialogs.last_message_id');

        if (MessagesSchema::hasArchive($this->db)) {
            $query->whereNull('canela_count_state.'.MessagesSchema::ARCHIVED_COLUMN);
        }

        // Pela gramática, para a coluna levar o prefixo das tabelas.
        $read = $this->db->getQueryGrammar()->wrap('canela_count_state.last_read_message_id');

        // Com as caixas de grupo, o que vejo pela equipe conta à parte.
        if (MessagesSchema::hasGroups($this->db)) {
            $via = $this->db->getQueryGrammar()->wrap('canela_count_state.'.MessagesSchema::VIA_GROUP_COLUMN);
            $query->selectRaw("SUM(CASE WHEN $read = 0 AND $via = 0 THEN 1 ELSE 0 END) AS new_count")
                ->selectRaw("SUM(CASE WHEN $read > 0 AND $via = 0 THEN 1 ELSE 0 END) AS unread_count")
                ->selectRaw("SUM(CASE WHEN $via = 1 THEN 1 ELSE 0 END) AS group_count");
        } else {
            $query->selectRaw("SUM(CASE WHEN $read = 0 THEN 1 ELSE 0 END) AS new_count")
                ->selectRaw("SUM(CASE WHEN $read > 0 THEN 1 ELSE 0 END) AS unread_count")
                ->selectRaw('0 AS group_count');
        }

        $row = $query->first();

        return [
            'new' => (int) ($row->new_count ?? 0),
            'unread' => (int) ($row->unread_count ?? 0),
            'group' => (int) ($row->group_count ?? 0),
        ];
    }
}
