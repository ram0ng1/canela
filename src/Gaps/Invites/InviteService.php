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

namespace Ramon\Canela\Gaps\Invites;

use Carbon\Carbon;
use Flarum\Http\UrlGenerator;
use Flarum\Notification\NotificationSyncer;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Gaps\Notification\InviteAcceptedBlueprint;
use Ramon\Canela\Support\SchemaCache;

/**
 * Os convites: gerar, listar, apagar e resgatar.
 *
 * O resgate acontece quando um cadastro chega com o código (o campo
 * `canelaInviteCode` do usuário): conta um uso e guarda quem convidou. O
 * aviso a quem convidou — "Fulano aceitou seu convite" — sai quando a conta é
 * ativada (NotifyInviteAccepted), e não antes de o e-mail ser confirmado.
 */
final class InviteService
{
    /** Quantos convites ativos uma pessoa pode ter de uma vez. */
    public const MAX_ACTIVE = 20;

    public const MAX_REDEMPTIONS = 100;

    private ?bool $tablesExist = null;

    public function __construct(
        private readonly GapsSettings $gaps,
        private readonly SettingsRepositoryInterface $settings,
        private readonly ConnectionInterface $db,
        private readonly UrlGenerator $url,
        private readonly NotificationSyncer $notifications,
    ) {
    }

    /**
     * O recurso só vale com a configuração ligada e as tabelas criadas: antes
     * da migration ele simplesmente não aparece, em vez de dar erro.
     */
    public function enabled(): bool
    {
        if (! $this->gaps->on(GapsSettings::INVITES)) {
            return false;
        }

        $schema = resolve(SchemaCache::class);

        return $this->tablesExist ??= $schema->hasTable('canela_invites') && $schema->hasTable('canela_invite_redemptions');
    }

    public function signUpOpen(): bool
    {
        return (bool) $this->settings->get('allow_sign_up');
    }

    public function canCreate(User $actor): bool
    {
        return $this->enabled() && ! $actor->isGuest() && $actor->hasPermission('canela.createInvite');
    }

    public function link(Invite $invite): string
    {
        return $this->url->to('forum')->route('canela.invite', ['code' => $invite->code]);
    }

    /** @return array<string, mixed> */
    public function present(Invite $invite): array
    {
        return [
            'id' => $invite->id,
            'code' => $invite->code,
            'url' => $this->link($invite),
            'maxRedemptions' => $invite->max_redemptions,
            'redemptionCount' => $invite->redemption_count,
            'expiresAt' => $invite->expires_at?->toAtomString(),
            'createdAt' => $invite->created_at?->toAtomString(),
            'usable' => $invite->isUsable(),
        ];
    }

    /** @return list<Invite> */
    public function listFor(User $actor): array
    {
        $query = Invite::query()->where('user_id', $actor->id)->latest('id');
        $query->limit(50);

        return $query->get()->values()->all();
    }

    public function create(User $actor, int $maxRedemptions, ?int $days): Invite
    {
        $active = Invite::query()
            ->where('user_id', $actor->id)
            ->whereColumn('redemption_count', '<', 'max_redemptions')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', Carbon::now()))
            ->count();

        if ($active >= self::MAX_ACTIVE) {
            throw new \RuntimeException('too_many_invites');
        }

        $invite = new Invite();
        $invite->code = Str::random(32);
        $invite->user_id = (int) $actor->id;
        $invite->max_redemptions = max(1, min(self::MAX_REDEMPTIONS, $maxRedemptions));
        $invite->redemption_count = 0;
        $invite->expires_at = Carbon::now()->addDays(max(1, min(90, $days ?? $this->gaps->inviteDays())));
        $invite->save();

        return $invite;
    }

    public function findUsable(string $code): ?Invite
    {
        if (! $this->enabled() || ! preg_match('/^[A-Za-z0-9]{32}$/', $code)) {
            return null;
        }

        $invite = Invite::query()->where('code', $code)->first();

        if (! $invite || ! $invite->isUsable()) {
            return null;
        }

        // O link vale enquanto quem convidou puder convidar: perdeu a
        // permissão, foi suspenso ou apagou a conta, os convites param — como
        // o fof/doorman, que confere o código no uso, e não só na criação.
        return $this->inviterCanInvite($invite->user) ? $invite : null;
    }

    private function inviterCanInvite(?User $inviter): bool
    {
        if (! $inviter instanceof User) {
            return false;
        }

        // O flarum/suspend já troca os grupos do suspenso por Visitante (sem a
        // permissão); a data confere também com a extensão desligada.
        $suspendedUntil = $inviter->getAttribute('suspended_until');

        if ($suspendedUntil !== null && Carbon::parse($suspendedUntil)->isFuture()) {
            return false;
        }

        return $inviter->hasPermission('canela.createInvite');
    }

    /**
     * Resgata o convite para quem acabou de se cadastrar. Um código inválido
     * ou esgotado não impede o cadastro — só não conta.
     */
    public function redeem(string $code, User $user): void
    {
        $invite = $this->findUsable($code);

        if (! $invite || $invite->user_id === (int) $user->id) {
            return;
        }

        $this->db->transaction(function () use ($invite, $user): bool {
            // Conta o uso só se ainda houver vaga (dois cadastros ao mesmo tempo).
            $updated = $this->db->table('canela_invites')
                ->where('id', $invite->id)
                ->whereColumn('redemption_count', '<', 'max_redemptions')
                ->increment('redemption_count');

            if (! $updated) {
                return false;
            }

            $this->db->table('canela_invite_redemptions')->insertOrIgnore([
                'user_id' => $user->id,
                'invite_id' => $invite->id,
                'created_at' => Carbon::now(),
            ]);

            return true;
        });

        // O aviso a quem convidou espera a conta valer: sai no Activated (ou
        // no Registered já confirmado) — NotifyInviteAccepted. O uso fica
        // reservado desde já, para o limite valer entre cadastros simultâneos.
    }

    /**
     * Avisa quem convidou que a pessoa entrou ("Fulano aceitou seu convite").
     * Chamado quando a conta é ativada; sem resgate guardado, nada.
     */
    public function notifyAccepted(User $user): void
    {
        if (! $this->enabled()) {
            return;
        }

        $inviteId = $this->db->table('canela_invite_redemptions')->where('user_id', $user->id)->value('invite_id');
        $inviter = $inviteId ? Invite::query()->find($inviteId)?->user : null;

        if ($inviter instanceof User && (int) $inviter->id !== (int) $user->id) {
            $this->notifications->sync(new InviteAcceptedBlueprint($user), [$inviter]);
        }
    }
}
