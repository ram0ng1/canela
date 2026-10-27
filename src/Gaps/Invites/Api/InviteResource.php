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

namespace Ramon\Canela\Gaps\Invites\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Gaps\Invites\Invite;
use Ramon\Canela\Gaps\Invites\InviteService;
use Tobyz\JsonApiServer\Context as OriginalContext;
use Tobyz\JsonApiServer\Pagination\OffsetPagination;
use Tobyz\JsonApiServer\Pagination\Pagination;

/**
 * `/api/canela-invites`: os links de convite de quem está logado.
 *
 * - GET lista os convites dele (os 50 mais novos), com `meta.signUpOpen` e
 *   `meta.canCreate` — este para o fórum esconder o botão "Gerar" de quem só
 *   pode revogar;
 * - POST gera um link (`maxRedemptions`, `expiresDays`), com a permissão
 *   `canela.createInvite`;
 * - DELETE /api/canela-invites/{id} apaga um convite dele (InvitePolicy).
 *
 * O escopo restringe tudo ao dono (ScopeInviteVisibility): o convite de outra
 * pessoa responde 404. Listar e apagar não pedem a permissão de convidar, para
 * quem a perdeu ainda poder revogar o que espalhou. Com o recurso desligado
 * (ou antes da migration), tudo responde 404.
 *
 * @extends AbstractDatabaseResource<Invite>
 */
final class InviteResource extends AbstractDatabaseResource
{
    /** A mensagem de quando a pessoa já tem o máximo de convites ativos (nos três idiomas). */
    public const TOO_MANY_KEY = 'ramon-canela.api.invites.too_many';

    /** A lista mostra só os mais novos: além disso, a janela de convites não rola. */
    private const LIST_LIMIT = 50;

    public function __construct(
        private readonly InviteService $invites,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        return 'canela-invites';
    }

    #[\Override]
    public function model(): string
    {
        return Invite::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        // `before` roda depois da autenticação e de achar o modelo, e antes de
        // qualquer escrita.
        $assertEnabled = function (): void {
            if (! $this->invites->enabled()) {
                throw new RouteNotFoundException();
            }
        };

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before($assertEnabled)
                ->paginate(self::LIST_LIMIT, self::LIST_LIMIT)
                ->query(function (Builder $query, ?Pagination $pagination, Context $context): Context {
                    $query->orderByDesc('canela_invites.id');

                    if ($pagination instanceof OffsetPagination) {
                        $pagination->apply($query);
                    }

                    return $context->withQuery($query);
                })
                ->meta([
                    Schema\Boolean::make('signUpOpen')
                        ->get(fn () => $this->invites->signUpOpen()),
                    Schema\Boolean::make('canCreate')
                        ->get(fn (Context $context) => $this->invites->canCreate($context->getActor())),
                ]),
            Endpoint\Create::make()
                ->authenticated()
                ->can('canela.createInvite')
                ->before($assertEnabled),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before($assertEnabled),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('code'),
            Schema\Str::make('url')
                ->get(fn (Invite $invite) => $this->invites->link($invite)),
            // Fora da faixa, o valor é preso aos limites (1–100) em vez de
            // recusado: a janela manda o que a pessoa digitou.
            Schema\Integer::make('maxRedemptions')
                ->writableOnCreate()
                ->set(static fn (Invite $invite, int $value) => $invite->max_redemptions = InviteService::clampRedemptions($value)),
            Schema\Integer::make('redemptionCount'),
            // Só na criação, e só de ida: a validade fica em `expiresAt`.
            Schema\Integer::make('expiresDays')
                ->visible(false)
                ->nullable()
                ->writableOnCreate()
                ->set(fn (Invite $invite, ?int $value) => $invite->expires_at = $this->invites->expiry($value)),
            Schema\DateTime::make('expiresAt'),
            Schema\DateTime::make('createdAt'),
            Schema\Boolean::make('usable')
                ->get(static fn (Invite $invite) => $invite->isUsable()),
        ];
    }

    /**
     * O dono é sempre quem gera, e o código nasce aqui. Ninguém passa de
     * MAX_ACTIVE convites ativos: o próximo é recusado com 422.
     */
    #[\Override]
    public function creating(object $model, OriginalContext $context): object
    {
        /** @var Invite $model */
        $actor = $context->getActor();

        if ($this->invites->activeCount($actor) >= InviteService::MAX_ACTIVE) {
            throw new ValidationException(['invites' => $this->translator->trans(self::TOO_MANY_KEY)]);
        }

        $model->code = InviteService::newCode();
        $model->user_id = (int) $actor->id;
        $model->redemption_count = 0;
        $model->max_redemptions ??= 1;
        $model->expires_at ??= $this->invites->expiry(null);

        return $model;
    }
}
