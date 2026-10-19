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

namespace Ramon\Canela\System\Console;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Console\Command;
use Ramon\Canela\System\Messages\CustomMessages;
use Ramon\Canela\System\Messages\MessageSender;
use Ramon\Canela\System\SystemUser;

/**
 * As mensagens personalizadas do agendador: "N dias depois de ativar a conta"
 * e "aniversário de X anos de conta". Só o que acontece depois de a mensagem
 * ser criada: ligar uma mensagem nova não manda nada de uma vez para os
 * membros antigos.
 */
final class SendDelayedMessages extends Command
{
    /** @var string */
    protected $signature = 'canela:system-messages';

    /** @var string */
    protected $description = 'Envia as mensagens automáticas personalizadas do agendador (dias depois do cadastro e aniversário de conta).';

    /** Por mensagem, por ciclo: um fórum grande espalha os envios pelas horas. */
    private const BATCH = 200;

    public function handle(CustomMessages $customs, MessageSender $sender, SystemUser $system): int
    {
        if (! $sender->available()) {
            $this->info('Sem usuário do sistema ou sem o flarum/messages; nada a enviar.');

            return self::SUCCESS;
        }

        $sent = 0;

        foreach ($customs->all() as $entry) {
            $window = $this->window($entry);

            if (! $entry['enabled'] || ! $window) {
                continue;
            }

            [$from, $until] = $window;

            $users = User::query()
                ->where('is_email_confirmed', true)
                ->where('joined_at', '>=', $from)
                ->where('joined_at', '<=', $until)
                ->where('id', '!=', (int) $system->id())
                ->whereNotIn('id', fn ($query) => $query->select('user_id')->from(MessageSender::TABLE)->where('type', CustomMessages::type($entry)))
                ->orderBy('id')
                ->limit(self::BATCH)
                ->get();

            $params = $entry['trigger'] === 'anniversary' ? ['years' => (int) $entry['value']] : [];

            foreach ($users as $user) {
                if ($user instanceof User && $sender->sendCustom($user, $entry, $params)) {
                    $sent++;
                }
            }
        }

        $this->info("Mensagens enviadas: $sent.");

        return self::SUCCESS;
    }

    /**
     * De quando a quando o cadastro precisa ter sido para a mensagem sair
     * agora, ou null se ela não é do agendador:
     *
     * - "N dias depois": cadastro depois de a mensagem existir e há N dias;
     * - aniversário de X anos: o aniversário (cadastro + X anos) caiu entre a
     *   criação da mensagem e agora.
     *
     * @param array{trigger: string, value: int|null, delay: int, createdAt: string} $entry
     * @return array{0: Carbon, 1: Carbon}|null
     */
    private function window(array $entry): ?array
    {
        $created = Carbon::parse($entry['createdAt']);

        if ($entry['trigger'] === 'activated' && $entry['delay'] > 0) {
            return [$created, Carbon::now()->subDays($entry['delay'])];
        }

        if ($entry['trigger'] === 'anniversary' && $entry['value']) {
            return [$created->copy()->subYears($entry['value']), Carbon::now()->subYears($entry['value'])];
        }

        return null;
    }
}
