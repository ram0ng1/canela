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

namespace Ramon\Canela\Templates\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\Exception\RouteNotFoundException;
use Ramon\Canela\Templates\Template;
use Ramon\Canela\Templates\TemplateFields;
use Ramon\Canela\Templates\TemplateIndex;
use Ramon\Canela\Templates\TemplatesSettings;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/canela-templates`: os modelos do editor.
 *
 * - GET lista e GET /{id}: públicos (o texto de um modelo vira o texto de um
 *   tópico, não há o que esconder). A lista vem na ordem do painel
 *   (`position`, depois o nome), com as tags de cada um.
 * - POST, PATCH e DELETE: só a administração.
 *
 * O tipo (`kind`) não é escolhido: vem de `required` ("sem texto livre").
 * Ligado, o modelo é um formulário (`form`): só os campos `{{campo}}` do
 * texto são preenchidos, e eles são refeitos a partir do texto a cada
 * gravação (TemplateFields::normalize). Desligado, é texto editável (`text`),
 * sem campos. O índice que o fórum recebe em toda página é
 * refeito depois de gravar ou apagar, no `after` do endpoint: a relação com
 * as tags só é sincronizada depois dos ganchos `saved`/`created` do recurso,
 * e um índice feito ali sairia sem elas. Com o recurso desligado no admin,
 * tudo é 404.
 *
 * @extends AbstractDatabaseResource<Template>
 */
final class TemplateResource extends AbstractDatabaseResource
{
    private const PER_PAGE = 100;

    public function __construct(
        private readonly TemplatesSettings $settings,
        private readonly TemplateIndex $index,
        private readonly ExtensionManager $extensions,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        return 'canela-templates';
    }

    #[\Override]
    public function model(): string
    {
        return Template::class;
    }

    #[\Override]
    public function endpoints(): array
    {
        $assertEnabled = function (): void {
            if (! $this->settings->enabled()) {
                throw new RouteNotFoundException();
            }
        };

        $reindex = function (Context $context, object $model): object {
            $this->index->rebuild();

            return $model;
        };

        return [
            Endpoint\Index::make()
                ->before($assertEnabled)
                ->paginate(self::PER_PAGE, self::PER_PAGE)
                ->defaultSort('position'),
            Endpoint\Show::make()
                ->before($assertEnabled),
            Endpoint\Create::make()
                ->authenticated()
                ->admin()
                ->before($assertEnabled)
                ->after($reindex),
            Endpoint\Update::make()
                ->authenticated()
                ->admin()
                ->before($assertEnabled)
                ->after($reindex),
            Endpoint\Delete::make()
                ->authenticated()
                ->admin()
                ->before($assertEnabled)
                ->after($reindex),
        ];
    }

    /** A ordem do seletor e do painel: `position`, depois o nome. */
    #[\Override]
    public function sorts(): array
    {
        return [
            SortColumn::make('position'),
            SortColumn::make('name'),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $fields = [
            Schema\Str::make('name')
                ->writable()
                ->requiredOnCreate()
                ->maxLength(TemplateFields::MAX_LABEL)
                ->set(static fn (Template $template, string $value) => $template->name = trim($value)),
            // Só leitura: decidido por `required` ao gravar (ver `saving()`).
            Schema\Str::make('kind'),
            Schema\Str::make('body')
                ->writable()
                ->requiredOnCreate()
                ->maxLength(TemplateFields::MAX_BODY),
            // A configuração de cada campo do formulário; a lista final vem do
            // texto, no `saving()`.
            Schema\Arr::make('fields')
                ->nullable()
                ->writable(),
            Schema\Boolean::make('required')
                ->writable(),
            Schema\Integer::make('position')
                ->writable(),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('updatedAt'),
        ];

        // A tabela `tags` (e o modelo dela) só existem com o flarum/tags.
        if ($this->extensions->isEnabled('flarum-tags')) {
            $fields[] = Schema\Relationship\ToMany::make('tags')
                ->type('tags')
                ->writable()
                ->includable()
                ->withLinkage();
        }

        return $fields;
    }

    /** O texto é a referência dos campos: a lista é refeita a partir dele. */
    #[\Override]
    public function saving(object $model, OriginalContext $context): object
    {
        /** @var Template $model */
        $model->required = (bool) $model->required;
        // "Sem texto livre" é o formulário; sem ele, texto editável.
        $model->kind = $model->required ? 'form' : 'text';
        $model->body = (string) $model->body;
        $model->fields = $model->isForm() ? TemplateFields::normalize($model->fields, $model->body) : null;
        $model->position = (int) $model->position;

        return $model;
    }
}
