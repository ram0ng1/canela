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

namespace Ramon\Canela\Chat\Api;

use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;

/**
 * `GET /api/chat/search?q=…[&channel=…][&sort=relevance|latest]`: "Pesquisar
 * no chat" — nas mensagens de todos os canais que o ator enxerga, ou só de um.
 *
 * Busca por trecho no texto digitado (não no HTML, que casaria com nomes de
 * tags e atributos). "Relevância" põe primeiro as que têm o termo como palavra
 * inteira; "Últimos", as mais novas.
 */
final class SearchController extends AbstractChatController
{
    private const LIMIT = 25;

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $term = trim((string) $this->query($request, 'q'));

        if (mb_strlen($term) < 2) {
            return ['results' => [], 'users' => [], 'channels' => []];
        }

        $channels = Channel::query();
        $this->access->scopeVisibleChannels($channels, $actor);

        $channelId = (int) ($this->query($request, 'channel') ?? 0);

        if ($channelId) {
            $channels->where('canela_chat_channels.id', $channelId);
        }

        $channels = $channels->get()->keyBy('id');

        $query = Message::query()
            ->whereIn('channel_id', $channels->keys()->all() ?: [0])
            ->whereNull('deleted_at')
            // Sem diferenciar maiúsculas em nenhum banco: no PostgreSQL vira
            // ILIKE (o LIKE de lá diferencia), no MySQL/MariaDB/SQLite, LIKE.
            ->whereLike('message', '%'.addcslashes($term, '\\%_').'%', caseSensitive: false)
            ->limit(self::LIMIT);

        if (($this->query($request, 'sort') ?? 'relevance') === 'relevance') {
            // Palavra inteira primeiro. Com LIKE, não REGEXP: o REGEXP não existe
            // no PostgreSQL nem no SQLite, e a borda de palavra muda entre MySQL
            // e MariaDB.
            $message = 'LOWER('.$query->getQuery()->getGrammar()->wrap('message').')';
            $word = mb_strtolower(addcslashes($term, '\\%_'));
            $query->orderByRaw(
                "CASE WHEN $message = ? OR $message LIKE ? OR $message LIKE ? OR $message LIKE ? THEN 0 ELSE 1 END",
                [mb_strtolower($term), $word.' %', '% '.$word, '% '.$word.' %']
            );
        }

        $messages = $query->orderByDesc('id')->get();

        $results = [];

        foreach ($messages->groupBy('channel_id') as $id => $group) {
            foreach ($this->presenter->messages($group, $channels->get($id), $actor) as $item) {
                $results[] = $item;
            }
        }

        $order = $messages->pluck('id')->flip();
        usort($results, static fn ($a, $b) => $order[$a['id']] <=> $order[$b['id']]);

        return [
            'results' => $results,
            'channels' => $this->presenter->channels($channels->only($messages->pluck('channel_id')->unique()->all())->values(), $actor, false),
            'users' => $this->presenter->users(),
        ];
    }
}
