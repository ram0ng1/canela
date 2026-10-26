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

namespace Ramon\Canela\Chat;

use Carbon\Carbon;
use Flarum\Notification\Notification;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Mention;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Notification\ChatMentionBlueprint;
use Ramon\Canela\Chat\Notification\ChatMessageBlueprint;
use Ramon\Canela\Support\Log;

/**
 * Menções e notificações das mensagens.
 *
 * - `@usuario` notifica quem participa do canal (numa MD, os participantes); um
 *   canal silenciado não notifica.
 * - `@here` notifica quem está ativo agora (visto nos últimos 5 minutos) e
 *   `@all` todo mundo do canal — só nos canais que permitem, e não para quem
 *   ligou "Ignorar menções em todo o canal".
 * - A mensagem direta (e a dos canais em "Para todas as atividades") gera a
 *   "Nova mensagem de chat", uma por conversa e remetente.
 */
final class ChatNotifier
{
    /** Preferência "Ignorar menções em todo o canal". */
    public const PREF_IGNORE_WIDE = 'canelaChatIgnoreChannelWideMention';

    /** Quem esteve no canal há menos que isso já está lendo: não precisa de alerta. */
    private const ACTIVE_SECONDS = 30;

    private const HERE_MINUTES = 5;

    /** @var array<string, bool> "tag|grupos" => enxerga */
    private array $seesTag = [];

    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly ChatAccess $access,
    ) {
    }

    /**
     * Grava as menções da mensagem e notifica os mencionados. Numa edição, quem
     * deixou de ser mencionado perde o alerta, e só os novos são avisados.
     *
     * @param int[] $userIds
     * @return int[] os usuários mencionados (os que receberam a menção)
     */
    public function mentions(Message $message, Channel $channel, User $sender, array $userIds, bool $here, bool $all, string $channelTitle): array
    {
        $wide = ($here || $all) && $channel->allow_channel_wide_mentions;

        // Sem @here/@all, só interessam os mencionados: carregar o canal
        // inteiro a cada mensagem seria uma consulta por membro.
        /** @var \Illuminate\Database\Eloquent\Collection<int, Membership> $members */
        $members = Membership::query()
            ->with('user.groups')
            ->where('channel_id', $channel->id)
            ->when(! $channel->isDirect(), static fn ($q) => $q->where('following', true))
            ->when(! $wide, static fn ($q) => $q->whereIn('user_id', $userIds ?: [0]))
            ->where('muted', false)
            ->where('user_id', '<>', $sender->id)
            ->get();

        $since = Carbon::now()->subMinutes(self::HERE_MINUTES);
        $recipients = [];

        foreach ($members as $member) {
            $user = $member->user;

            if (! $user || ! $this->access->canUse($user) || ! $this->stillSees($channel, $user)) {
                continue;
            }

            $kind = null;

            if (in_array($member->user_id, $userIds, true)) {
                $kind = 'user';
            } elseif ($wide && ! $user->getPreference(self::PREF_IGNORE_WIDE, false)) {
                if ($all) {
                    $kind = 'all';
                } elseif ($user->last_seen_at && $user->last_seen_at->greaterThan($since)) {
                    $kind = 'here';
                }
            }

            if ($kind) {
                $recipients[$user->id] = ['user' => $user, 'kind' => $kind];
            }
        }

        Mention::query()->where('message_id', $message->id)->whereNotIn('user_id', array_keys($recipients) ?: [0])->delete();

        $existing = Mention::query()->where('message_id', $message->id)->pluck('user_id')->map(static fn ($id) => (int) $id)->all();
        $rows = [];

        foreach ($recipients as $id => $recipient) {
            if (! in_array($id, $existing, true)) {
                $rows[] = ['message_id' => $message->id, 'user_id' => $id, 'kind' => $recipient['kind'], 'created_at' => Carbon::now()];
            }
        }

        if ($rows) {
            Mention::query()->insert($rows);
        }

        $kinds = array_unique(array_column($recipients, 'kind')) ?: ['user'];

        // Uma notificação por mensagem: o tipo de menção vai nos dados para o
        // texto do alerta, mas uma só basta — então vale o "mais forte".
        //
        // Nada que mude numa edição entra aqui (nem o trecho do texto): o core
        // reconhece a notificação pelos dados, e com eles estáveis o `sync`
        // mantém a de quem continua mencionado, cria a dos novos e apaga a de
        // quem saiu — sem alertar de novo a cada correção de vírgula.
        $data = [
            'channelId' => $channel->id,
            'messageId' => $message->id,
            'threadId' => $message->thread_id,
            'channelTitle' => $channelTitle,
            'slug' => (string) ($channel->slug ?: 'dm'),
            'kind' => in_array('user', $kinds, true) ? 'user' : $kinds[0],
        ];

        try {
            $this->notifications->sync(new ChatMentionBlueprint($sender, $data), array_values(array_column($recipients, 'user')));
        } catch (\Throwable $error) {
            Log::warning('chat: notificação de menção falhou: '.$error->getMessage());
        }

        return array_keys($recipients);
    }

    /**
     * A "Nova mensagem de chat" para as MDs e os canais em "sempre".
     *
     * @param int[] $skip quem já foi avisado por menção
     */
    public function message(Message $message, Channel $channel, User $sender, array $skip): void
    {
        $active = Carbon::now()->subSeconds(self::ACTIVE_SECONDS);

        $query = Membership::query()
            ->with('user.groups')
            ->where('channel_id', $channel->id)
            ->where('muted', false)
            ->where('user_id', '<>', $sender->id)
            ->whereNotIn('user_id', $skip ?: [0])
            ->where(static fn ($q) => $q->whereNull('last_viewed_at')->orWhere('last_viewed_at', '<', $active));

        if ($channel->isDirect()) {
            $query->where('notification_level', '<>', Membership::NOTIFY_NEVER);
        } else {
            $query->where('following', true)->where('notification_level', Membership::NOTIFY_ALWAYS);
        }

        $users = $query->get()->map(static fn (Membership $m) => $m->user)->filter(fn (?User $u) => $u && $this->access->canUse($u) && $this->stillSees($channel, $u))->values();

        if ($users->isEmpty()) {
            return;
        }

        $blueprint = new ChatMessageBlueprint($sender, [
            'channelId' => $channel->id,
            'slug' => (string) ($channel->slug ?: 'dm'),
            'isDirect' => $channel->isDirect(),
            'name' => $channel->isDirect() && ! $channel->is_group ? null : $channel->name,
        ]);

        try {
            // A já lida sai, para a próxima mensagem alertar de novo; a não
            // lida fica (o core só a mantém, sem duplicar).
            Notification::matchingBlueprint($blueprint)
                ->whereIn('user_id', $users->pluck('id')->all())
                ->whereNotNull('read_at')
                ->delete();

            $this->notifications->sync($blueprint, $users->all());
        } catch (\Throwable $error) {
            Log::warning('chat: notificação de mensagem falhou: '.$error->getMessage());
        }
    }

    /**
     * Se o membro ainda enxerga o canal: quem perdeu acesso à tag do canal
     * continua na lista de membros, mas não recebe mais alertas dele.
     *
     * A visibilidade das tags vem das permissões dos grupos, então a resposta
     * fica guardada por conjunto de grupos — uma consulta por combinação, e
     * não uma por membro.
     */
    private function stillSees(Channel $channel, User $user): bool
    {
        if ($channel->isDirect() || $channel->tag_id === null) {
            return true;
        }

        $groups = $user->isAdmin() ? 'admin' : implode(',', $user->groups->pluck('id')->sort()->all());
        // A suspensão também muda as permissões, então entra na chave.
        $key = $channel->tag_id.'|'.$groups.'|'.($this->access->isSuspended($user) ? 's' : '');

        return $this->seesTag[$key] ??= $this->access->canSeeChannel($channel, $user);
    }

    /** A mensagem apagada leva junto o alerta de menção dela. */
    public function forgetMessage(Message $message): void
    {
        Mention::query()->where('message_id', $message->id)->delete();

        Notification::query()
            ->where('type', ChatMentionBlueprint::TYPE)
            // Pelo caminho do JSON, não por LIKE no texto: o MySQL (coluna JSON)
            // e o PostgreSQL não guardam o JSON com a mesma formatação.
            ->where('data->channelId', (int) $message->channel_id)
            ->where('data->messageId', (int) $message->id)
            ->update(['is_deleted' => true]);
    }

    /** Ler o canal marca como lidas as notificações dele. */
    public function markChannelRead(Channel $channel, User $actor): void
    {
        Notification::query()
            ->where('user_id', $actor->id)
            ->whereIn('type', [ChatMentionBlueprint::TYPE, ChatMessageBlueprint::TYPE])
            ->whereNull('read_at')
            ->where('data->channelId', (int) $channel->id)
            ->update(['read_at' => Carbon::now()]);
    }
}
