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

namespace Ramon\Canela\System;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Support\Str;

/**
 * O usuário do sistema, como o `system` do Discourse: quem assina as
 * notificações automáticas e as mensagens do sistema. Aparece como um
 * usuário comum (perfil, avatar, bio), mas nunca entra: sem login por senha
 * (SystemPasswordChecker), sem sessão nem token (RevokeSystemSession) e sem
 * receber mensagens de ninguém (SystemUserPolicy).
 *
 * O admin cria o usuário pelo painel; o id fica em `canela.system_user_id`.
 * Sem ele (ou se a conta for apagada), tudo volta ao que era antes: as
 * notificações sem remetente e nenhuma mensagem automática.
 */
final class SystemUser
{
    public const SETTING = 'canela.system_user_id';

    /** O domínio reservado `.invalid` (RFC 2606): nenhum e-mail chega lá. */
    public const EMAIL_DOMAIN = 'system.invalid';

    /** Uma consulta por requisição; `false` = já procurou e não existe. */
    private User|false|null $user = null;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /** Atalho para quem não recebe dependências (os blueprints de notificação). */
    public static function current(): ?User
    {
        return resolve(self::class)->get();
    }

    public function id(): ?int
    {
        $id = (int) $this->settings->get(self::SETTING);

        return $id > 0 ? $id : null;
    }

    public function get(): ?User
    {
        if ($this->user === null) {
            $id = $this->id();
            $this->user = ($id ? User::query()->find($id) : null) ?? false;
        }

        return $this->user ?: null;
    }

    public function is(User|int|null $user): bool
    {
        $id = $user instanceof User ? (int) $user->id : (int) $user;

        return $id > 0 && $id === $this->id();
    }

    /** Esquece o usuário guardado (depois de criar ou desvincular). */
    public function forget(): void
    {
        $this->user = null;
    }

    /**
     * Cria a conta e a guarda como o usuário do sistema. O nome de usuário é
     * `system` (ou `system1`, `system2`… se já existir); o e-mail é de um
     * domínio que não recebe nada e a senha é aleatória e descartada, mas nem
     * uma nem outra serviriam: a conta não entra de jeito nenhum.
     */
    public function create(string $bio): User
    {
        $username = 'system';

        for ($i = 1; User::query()->where('username', $username)->exists(); $i++) {
            $username = 'system'.$i;
        }

        // Direto no modelo, sem a API de cadastro: nenhum evento de cadastro ou
        // ativação sai (nada de boas-vindas, e-mail ou emblema para ele).
        $user = new User();
        $user->username = $username;
        $user->email = 'system-'.Str::lower(Str::random(16)).'@'.self::EMAIL_DOMAIN;
        $user->password = Str::random(64);
        $user->is_email_confirmed = true;
        $user->joined_at = Carbon::now();

        $schema = $user->getConnection()->getSchemaBuilder();

        // A bio do perfil do tema ("Não é uma pessoa de verdade…", como a do
        // Discourse) e o nível de confiança mais alto, travado: a conta não
        // deve ser promovida nem rebaixada pelas regras dos níveis.
        if ($bio !== '' && $schema->hasColumn('users', 'canela_bio')) {
            $user->setAttribute('canela_bio', $bio);
        }

        if ($schema->hasColumn('users', 'canela_trust_level')) {
            $user->setAttribute('canela_trust_level', 4);
            $user->setAttribute('canela_trust_level_locked', true);
        }

        $user->save();

        $this->settings->set(self::SETTING, (string) $user->id);
        $this->user = $user;

        return $user;
    }
}
