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

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Badges\SystemBadges;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/canela-badges`: a página /badges e o admin de emblemas.
 *
 * Quem não é admin só vê emblemas ligados; na listagem, também só os
 * listáveis e os que este fórum consegue conceder — "Primeira curtida" sem o
 * flarum/likes seria um emblema impossível na vitrine. Um emblema que já foi
 * concedido continua à vista mesmo que a extensão dele tenha sido desligada.
 *
 * Criar, editar e remover é só para o admin. Um emblema do sistema pode ser
 * editado (nome, descrição, ícone, tipo…) sem perder a regra automática, que
 * é procurada pelo slug — e o slug não se edita.
 *
 * @extends AbstractDatabaseResource<Badge>
 */
final class BadgeResource extends AbstractDatabaseResource
{
    /** Ícone do Font Awesome: estilo + nome, como o core aceita nos grupos e tags. */
    private const ICON_PATTERN = '/^(fas|far|fab|fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/';

    public function __construct(
        private readonly BadgeSettings $settings,
        private readonly Capabilities $capabilities,
        private readonly BadgeQueries $queries,
        private readonly TranslatorInterface $translator,
        private readonly ConnectionInterface $db,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        // Com prefixo: o tipo vira o nome das rotas (`badges.index`), e outra
        // extensão de emblemas com o tipo `badges` derrubava o fórum no boot
        // ("Route badges.index already exists").
        return 'canela-badges';
    }

    #[\Override]
    public function model(): string
    {
        return Badge::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        if ($context->getActor()->isAdmin()) {
            return;
        }

        $query->where('canela_badges.enabled', true);

        // Só na vitrine (/badges): incluído numa concessão ou numa notificação,
        // um emblema não listável continua aparecendo para quem o ganhou.
        if ($context instanceof Context && $context->listing(self::class)) {
            $unavailable = array_values(array_filter(
                array_keys(SystemBadges::DEFINITIONS),
                fn (string $slug) => ! $this->queries->available($slug)
            ));

            $query->where('canela_badges.listable', true)
                ->where(fn (Builder $visible) => $visible
                    ->whereNotIn('canela_badges.slug', $unavailable ?: [''])
                    ->orWhereHas('userBadges'));
        }
    }

    #[\Override]
    public function endpoints(): array
    {
        // Antes das migrações a rota fica invisível (403, nunca um erro de banco);
        // desligado no admin, o recurso não existe (404) — menos para o admin,
        // que continua administrando os emblemas com eles desligados no fórum.
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
                ->defaultSort('position'),
            Endpoint\Show::make()
                ->visible($installed)
                ->before($enabled)
                ->can('viewForum'),
            Endpoint\Create::make()
                ->visible($installed)
                ->admin(),
            Endpoint\Update::make()
                ->visible($installed)
                ->admin(),
            Endpoint\Delete::make()
                ->visible($installed)
                ->admin(),
            // "Conceder agora": a mesma carga do comando diário, para o admin
            // ver o resultado de um emblema recém-ligado sem esperar o agendador.
            Endpoint\Endpoint::make('canelaRecalculate')
                ->route('POST', '/recalculate')
                ->visible($installed)
                ->admin()
                ->action(function () {
                    // A primeira carga é completa (lê o conteúdo de todas as
                    // postagens) e passaria do tempo de uma requisição: só pelo
                    // comando, que roda sem esse limite.
                    if (! $this->settings->backfilled()) {
                        throw new ValidationException(['badges' => $this->translator->trans('ramon-canela.api.badges_admin.first_backfill_cli')]);
                    }

                    resolve(BadgeGranter::class)->backfill();
                })
                ->response(fn () => new EmptyResponse(204)),
            // "Restaurar emblemas do sistema": tira a marca dos removidos e
            // recria os que faltam. Os que existem (editados ou não) ficam.
            Endpoint\Endpoint::make('canelaRestoreSystem')
                ->route('POST', '/restore-system')
                ->visible($installed)
                ->admin()
                ->action(function () {
                    $this->settings->clearSystemRemoved();

                    return SystemBadges::seed($this->db);
                })
                ->response(fn (Context $context, int $restored) => new JsonResponse(['meta' => ['restored' => $restored]])),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $isAdmin = fn (Badge $badge, Context $context) => $context->getActor()->isAdmin();
        $adminColumns = fn () => $this->capabilities->adminColumns();
        // Concessão múltipla e manual são da regra nos emblemas do sistema.
        $customOnly = fn (Badge $badge, Context $context) => $context->getActor()->isAdmin() && ! $badge->isAutomatic();

        return [
            Schema\Str::make('slug'),
            Schema\Str::make('name')
                ->get(fn (Badge $badge) => $badge->translated($this->translator, 'name'))
                ->writable($isAdmin)
                ->requiredOnCreate()
                ->minLength(1)
                ->maxLength(100)
                ->set(fn (Badge $badge, string $value) => $badge->name = trim($value)),
            Schema\Str::make('description')
                ->nullable()
                ->get(fn (Badge $badge) => $badge->translated($this->translator, 'description', $this->parameters()))
                ->writable($isAdmin)
                ->maxLength(500)
                ->set(fn (Badge $badge, ?string $value) => $badge->description = $this->clean($value)),
            // Na página do emblema e no admin: na grade pública pesaria à toa.
            Schema\Str::make('longDescription')
                ->nullable()
                ->visible(fn (Badge $badge, Context $context) => $context->showing(self::class) || $context->getActor()->isAdmin())
                ->get(fn (Badge $badge) => $badge->translated($this->translator, 'long_description', $this->parameters()))
                ->writable($isAdmin)
                ->maxLength(2000)
                ->set(fn (Badge $badge, ?string $value) => $badge->long_description = $this->clean($value)),
            Schema\Str::make('icon')
                ->writable($isAdmin)
                ->regex(self::ICON_PATTERN)
                ->maxLength(100),
            Schema\Str::make('imageUrl')
                ->nullable()
                ->visible($adminColumns)
                ->writable(fn (Badge $badge, Context $context) => $context->getActor()->isAdmin() && $this->capabilities->adminColumns())
                ->maxLength(500)
                ->rule('url:http,https')
                ->set(fn (Badge $badge, ?string $value) => $badge->image_url = $this->clean($value)),
            Schema\Str::make('type')
                ->writable($isAdmin)
                ->in(Badge::TYPES),
            Schema\Str::make('grouping')
                ->writable($isAdmin)
                ->in(SystemBadges::GROUPINGS),
            Schema\Integer::make('position'),
            Schema\Boolean::make('multipleGrant')
                ->property('multiple_grant')
                ->writable($customOnly),
            Schema\Boolean::make('system'),
            Schema\Boolean::make('enabled')
                ->writable($isAdmin),
            Schema\Boolean::make('listable')
                ->writable($isAdmin),
            Schema\Boolean::make('allowTitle')
                ->visible($adminColumns)
                ->get(fn (Badge $badge) => (bool) $badge->allow_title)
                ->writable(fn (Badge $badge, Context $context) => $context->getActor()->isAdmin() && $this->capabilities->adminColumns()),
            Schema\Boolean::make('manualGrant')
                ->visible($adminColumns)
                ->get(fn (Badge $badge) => $badge->isManuallyGrantable())
                ->writable(fn (Badge $badge, Context $context) => $customOnly($badge, $context) && $this->capabilities->adminColumns()),
            // Para o admin: tem regra automática / pode ser concedido à mão.
            Schema\Boolean::make('automatic')
                ->visible($isAdmin)
                ->get(fn (Badge $badge) => $badge->isAutomatic()),
            Schema\Boolean::make('canGrant')
                ->visible($isAdmin)
                ->get(fn (Badge $badge) => $badge->isManuallyGrantable()),
            // Se este fórum tem o que a regra precisa medir (extensão, tabela).
            Schema\Boolean::make('available')
                ->visible($isAdmin)
                ->get(fn (Badge $badge) => ! $badge->isAutomatic() || $this->queries->available($badge->slug)),
            Schema\Integer::make('grantCount')
                ->countRelation('userBadges'),
            Schema\DateTime::make('createdAt'),
        ];
    }

    #[\Override]
    public function sorts(): array
    {
        return [
            SortColumn::make('position'),
            SortColumn::make('name'),
        ];
    }

    /** Emblema novo: personalizado, com slug próprio, no fim da lista. */
    #[\Override]
    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Badge $model */
        $model->system = false;
        $model->slug = $this->uniqueSlug((string) $model->name);
        $model->position = (int) Badge::query()->max('position') + 1;
        $model->created_at = Carbon::now();
        $model->icon = $model->icon ?: 'fas fa-certificate';
        $model->type = $model->type ?: Badge::BRONZE;
        $model->grouping = $model->grouping ?: 'other';
        $model->enabled ??= true;
        $model->listable ??= true;
        $model->multiple_grant ??= false;

        return $model;
    }

    /** Dois emblemas com o mesmo nome confundiriam a página e a notificação. */
    #[\Override]
    public function saving(object $model, OriginalContext $context): ?object
    {
        /** @var Badge $model */
        if ($model->isDirty('name')) {
            $taken = Badge::query()
                ->where('name', $model->name)
                ->when($model->exists, fn ($query) => $query->whereKeyNot($model->getKey()))
                ->exists();

            if ($taken) {
                throw new ValidationException(['name' => $this->translator->trans('ramon-canela.api.badges_admin.name_taken')]);
            }
        }

        return $model;
    }

    /**
     * Remover um do sistema deixa a marca: sem ela, uma semente futura o
     * recriaria. As concessões vão junto (chave estrangeira).
     */
    #[\Override]
    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var Badge $model */
        if ($model->system) {
            $this->settings->markSystemRemoved($model->slug);
        }

        parent::deleting($model, $context);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'badge';
        $slug = $base;
        $suffix = 2;

        // Um slug igual ao de um emblema do sistema (mesmo removido) faria a
        // regra automática valer para o personalizado.
        while (SystemBadges::isSystem($slug) || Badge::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    private function clean(?string $value): ?string
    {
        $value = $value === null ? null : trim($value);

        return $value === '' ? null : $value;
    }

    /** Os números que as descrições citam ("Usou 50 curtidas no mesmo dia"). */
    private function parameters(): array
    {
        return ['{max}' => $this->settings->maxLikesPerDay()];
    }
}
