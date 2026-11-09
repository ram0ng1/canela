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

namespace Ramon\Canela\Assign;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Ramon\Canela\System\SystemUser;

/**
 * O assistente do "Atribuir tópico": uma conta à parte da do sistema
 * (`assistente`) que, quando recebe um tópico, responde nele com a IA do tema
 * (AssistantReplyJob). O admin cria a conta pelo painel; o id fica em
 * `canela.assign_bot_user_id`.
 */
final class AssistantBot
{
    public const SETTING = 'canela.assign_bot_user_id';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function id(): ?int
    {
        $id = (int) $this->settings->get(self::SETTING);

        return $id > 0 ? $id : null;
    }

    public function get(): ?User
    {
        $id = $this->id();

        return $id ? User::query()->find($id) : null;
    }

    public function is(?User $user): bool
    {
        return $user !== null && $this->id() === (int) $user->id;
    }

    /** Cria a conta, ou devolve a que já existe (dois cliques não criam duas). */
    public function create(string $bio): User
    {
        $user = $this->get();

        if ($user === null) {
            $user = SystemUser::account('assistente', $bio);
            $this->settings->set(self::SETTING, (string) $user->id);
        }

        return $user;
    }
}
