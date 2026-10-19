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

namespace Ramon\Canela\Badges\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Badges\UserBadge;
use Ramon\Canela\Badges\UserBadgeVisibility;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/canela-user-badges`: os emblemas de alguém (`filter[user]`) ou quem ganhou
 * um emblema (`filter[badge]`), os mais recentes primeiro.
 *
 * A listagem passa pelo UserBadgeSearcher (o Flarum filtra por searcher, não
 * pelo recurso), que aplica a mesma visibilidade do `scope()` daqui.
 *
 * O admin concede à mão (`POST /canela-user-badges/grant`, o "Award badge" do
 * Discourse) e revoga (`DELETE /canela-user-badges/:id`).
 *
 * @extends AbstractDatabaseResource<UserBadge>
 */
final class UserBadgeResource extends AbstractDatabaseResource
{
    private const REASON_MAX_LENGTH = 500;

    public function __construct(
        private readonly BadgeSettings $settings,
        private readonly Capabilities $capabilities,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        // Com prefixo, como o `canela-badges` (ver BadgeResource::type()).
        return 'canela-user-badges';
    }

    #[\Override]
    public function model(): string
    {
        return UserBadge::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        UserBadgeVisibility::apply($query, $context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        // Antes das migrações a rota fica invisível (403, nunca um erro de banco);
        // desligado no admin, o recurso não existe (404) — menos para o admin.
        $installed = fn () => $this->capabilities->installed();
        $enabled = function (Context $context) {
            if (! $context->getActor()->isAdmin()) {
                $this->settings->assertBadgesEnabled();
            }
        };

        return [
            Endpoint\Index::make()
                ->visible($installed)
                ->before($enabled)
                ->can('viewForum')
                ->defaultInclude(['badge', 'user'])
                ->eagerLoad(['badge', 'user'])
                ->defaultSort('-grantedAt')
                ->paginate(30, 100),
            Endpoint\Show::make()
                ->visible($installed)
                ->before($enabled)
                ->can('viewForum')
                ->defaultInclude(['badge', 'user']),
            Endpoint\Endpoint::make('canelaGrant')
                ->route('POST', '/grant')
                ->visible($installed)
                ->admin()
                ->action(fn (Context $context) => $this->grant($context))
                ->response(fn (Context $context, UserBadge $userBadge) => new JsonResponse(['meta' => ['id' => (string) $userBadge->id]], 201)),
            // Revogar uma concessão, como no admin do Discourse. A notificação
            // daquela concessão vai junto (UserBadge::booted).
            Endpoint\Delete::make()
                ->visible($installed)
                ->admin(),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\DateTime::make('grantedAt'),
            // O motivo (ou link) de uma concessão manual — público, como no
            // Discourse, onde ele aparece na página do emblema.
            Schema\Str::make('reason')
                ->nullable()
                ->visible(fn () => $this->capabilities->adminColumns()),

            Schema\Relationship\ToOne::make('user')
                ->type('users')
                ->includable(),
            Schema\Relationship\ToOne::make('badge')
                ->type('canela-badges')
                ->includable(),
            // A postagem que rendeu o emblema; a visibilidade dela é a do
            // recurso de posts, aplicada na inclusão.
            Schema\Relationship\ToOne::make('post')
                ->type('posts')
                ->includable(),
        ];
    }

    #[\Override]
    public function sorts(): array
    {
        return [
            SortColumn::make('grantedAt'),
        ];
    }

    /**
     * Corpo: `{"badgeId": 12, "username": "fulano", "reason": "…"}`. Valida
     * tudo antes de gravar: emblema que aceita concessão manual, pessoa que
     * existe, emblema de concessão única que a pessoa ainda não tem, motivo
     * curto e — se for um endereço — http(s).
     */
    private function grant(Context $context): UserBadge
    {
        $body = (array) $context->body();
        $badgeId = (int) Arr::get($body, 'badgeId', 0);
        $username = trim((string) Arr::get($body, 'username', ''));
        $reason = trim((string) Arr::get($body, 'reason', ''));
        $reason = $reason === '' ? null : $reason;

        /** @var Badge|null $badge */
        $badge = $badgeId > 0 ? Badge::query()->find($badgeId) : null;

        if (! $badge) {
            $this->fail('badge', 'badge_not_found');
        }

        if (! $badge->isManuallyGrantable()) {
            $this->fail('badge', 'badge_not_grantable');
        }

        /** @var User|null $user */
        $user = $username === '' ? null : User::query()->where('username', $username)->first();

        if (! $user) {
            $this->fail('username', 'user_not_found');
        }

        if (! $badge->multiple_grant && UserBadge::query()->where('badge_id', $badge->id)->where('user_id', $user->id)->exists()) {
            $this->fail('username', 'already_granted');
        }

        if ($reason !== null) {
            $looksLikeUrl = preg_match('#^[a-z][a-z0-9+.-]*://#i', $reason) === 1;

            if (mb_strlen($reason) > self::REASON_MAX_LENGTH || ($looksLikeUrl && ! filter_var($reason, FILTER_VALIDATE_URL)) || ($looksLikeUrl && ! preg_match('#^https?://#i', $reason))) {
                $this->fail('reason', 'invalid_reason');
            }
        }

        return resolve(BadgeGranter::class)->grantManually($badge, $user, $context->getActor(), $reason);
    }

    private function fail(string $field, string $key): never
    {
        throw new ValidationException([$field => $this->translator->trans("ramon-canela.api.badges_admin.$key")]);
    }
}
