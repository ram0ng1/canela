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

namespace Ramon\Canela\Messages\Reactions;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Support\SchemaCache;

/**
 * Reações nas mensagens privadas: uma reação por pessoa por mensagem
 * (`canela_dialog_message_reactions`).
 *
 * A lista de reações é a do fof/reactions quando ele está ligado (a chave é
 * o id da reação dele, e o fórum desenha com o componente dele); sem ele, a
 * lista padrão, com a chave sendo o nome do emoji.
 *
 * Sem a tabela (migration ainda não rodada) nada é lido nem gravado, e o
 * fórum esconde o botão.
 */
final class MessageReactions
{
    public const TABLE = 'canela_dialog_message_reactions';

    /** As reações padrão, sem o fof/reactions. */
    public const DEFAULTS = ['heart', '+1', 'laughing', 'open_mouth', 'cry', 'tada', 'rocket'];

    private static ?bool $exists = null;

    /** @var array<int, true> mensagens à espera do resumo */
    private static array $pending = [];

    /** @var array<int, array<int, object>> mensagem => linhas (reaction, user_id) */
    private static array $loaded = [];

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function enabled(): bool
    {
        return self::$exists ??= resolve(SchemaCache::class)->hasTable(self::TABLE);
    }

    public function usesFof(): bool
    {
        return $this->extensions->isEnabled('fof-reactions');
    }

    /** A chave é uma reação válida agora (habilitada no fof/reactions, ou da lista padrão). */
    public function isValid(string $key): bool
    {
        if ($this->usesFof()) {
            return ctype_digit($key) && $this->db->table('reactions')->where('id', (int) $key)->where('enabled', true)->exists();
        }

        return in_array($key, self::DEFAULTS, true);
    }

    /**
     * As contagens por reação e a minha, numa consulta só.
     *
     * @return array{counts: array<string, int>, mine: string|null}
     */
    public function summary(int $messageId, ?User $actor): array
    {
        if (! $this->enabled()) {
            return ['counts' => [], 'mine' => null];
        }

        self::$pending[$messageId] = true;
        $this->loadPending();

        return $this->tally(self::$loaded[$messageId] ?? [], $actor);
    }

    /**
     * O mesmo resumo, adiado: o serializador resolve as closures de um nível
     * inteiro de uma vez, e a primeira busca as reações de todas as mensagens
     * anotadas numa consulta só (e não uma por mensagem).
     *
     * @return \Closure(): array{counts: array<string, int>, mine: string|null}
     */
    public function deferSummary(int $messageId, ?User $actor): \Closure
    {
        if (! array_key_exists($messageId, self::$loaded)) {
            self::$pending[$messageId] = true;
        }

        return function () use ($messageId, $actor): array {
            if (! $this->enabled()) {
                return ['counts' => [], 'mine' => null];
            }

            $this->loadPending();

            return $this->tally(self::$loaded[$messageId] ?? [], $actor);
        };
    }

    private function loadPending(): void
    {
        $ids = array_keys(self::$pending);

        if (! $ids) {
            return;
        }

        self::$pending = [];

        foreach ($ids as $id) {
            self::$loaded[$id] = [];
        }

        $rows = $this->db->table(self::TABLE)
            ->whereIn('message_id', $ids)
            ->get(['message_id', 'reaction', 'user_id']);

        foreach ($rows as $row) {
            self::$loaded[(int) $row->message_id][] = $row;
        }
    }

    /**
     * @param array<int, object> $rows
     * @return array{counts: array<string, int>, mine: string|null}
     */
    private function tally(array $rows, ?User $actor): array
    {
        $counts = [];
        $mine = null;

        foreach ($rows as $row) {
            $counts[$row->reaction] = ($counts[$row->reaction] ?? 0) + 1;

            if ($actor && (int) $row->user_id === (int) $actor->id) {
                $mine = (string) $row->reaction;
            }
        }

        arsort($counts);

        return ['counts' => $counts, 'mine' => $mine];
    }

    /**
     * Reage (ou desfaz, com `null`). Devolve se a reação é nova — trocar de
     * emoji também conta, para o autor ser avisado da reação atual.
     */
    public function react(int $messageId, User $actor, ?string $key): bool
    {
        // A resposta precisa ler a reação nova, e não a do lote já carregado.
        unset(self::$loaded[$messageId]);

        $current = $this->db->table(self::TABLE)->where('message_id', $messageId)->where('user_id', $actor->id)->value('reaction');

        if ($key === null) {
            $this->db->table(self::TABLE)->where('message_id', $messageId)->where('user_id', $actor->id)->delete();

            return false;
        }

        if ($current === $key) {
            return false;
        }

        // Numa instrução só (INSERT … ON DUPLICATE KEY UPDATE): o
        // `updateOrInsert` conferia e depois inseria, e dois cliques ao mesmo
        // tempo (duas abas, clique duplo) batiam no índice único e davam erro
        // 500. Assim vale a última reação, como numa troca de emoji.
        $this->db->table(self::TABLE)->upsert(
            [['message_id' => $messageId, 'user_id' => $actor->id, 'reaction' => $key, 'created_at' => Carbon::now()]],
            ['message_id', 'user_id'],
            ['reaction', 'created_at']
        );

        return true;
    }

    /**
     * Quem reagiu, agrupado por reação (o modal "quem reagiu").
     *
     * @return array<int, array{reaction: string, users: array<int, array{id: string, username: string, displayName: string, avatarUrl: string|null}>}>
     */
    public function reactors(int $messageId): array
    {
        if (! $this->enabled()) {
            return [];
        }

        $rows = $this->db->table(self::TABLE)
            ->where('message_id', $messageId)
            ->orderBy('created_at')
            ->get(['reaction', 'user_id']);

        // Pelos modelos: o nome de exibição e a URL do avatar passam pelos
        // acessores do core (apelidos, disco de avatares).
        $users = User::query()->whereIn('id', $rows->pluck('user_id')->all())->get()->keyBy('id');
        $groups = [];

        foreach ($rows as $row) {
            $user = $users->get($row->user_id);

            if (! $user) {
                continue;
            }

            $groups[$row->reaction][] = [
                'id' => (string) $user->id,
                'username' => (string) $user->username,
                'displayName' => (string) $user->display_name,
                'avatarUrl' => $user->avatar_url,
            ];
        }

        $result = [];

        foreach ($groups as $reaction => $users) {
            $result[] = ['reaction' => (string) $reaction, 'users' => $users];
        }

        usort($result, static fn ($a, $b) => count($b['users']) <=> count($a['users']));

        return $result;
    }
}
