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

/*
 * Modelos do editor: o texto que preenche o composer de um tópico novo,
 * por categoria/etiqueta (ou em todas). Dois tipos:
 *
 * - texto pré-preenchido, que quem escreve muda à vontade;
 * - formulário, em que só os campos marcados com {{campo}} no texto são
 *   preenchidos e o resto sai como está (bom para fóruns de suporte).
 *
 * O admin cria quantos quiser por tag (painel no card "Modelos do editor");
 * com vários numa tag, o composer mostra um seletor. `required` tira a opção
 * de texto livre onde o modelo vale.
 *
 * O fórum recebe só o índice (id, nome, tipo, tags) em toda página, de uma
 * configuração refeita a cada gravação (TemplateIndex); o texto e os campos
 * descem pela API quando o modelo é escolhido.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Event\Deleting;
use Ramon\Canela\Templates\Api\TemplateResource;
use Ramon\Canela\Templates\Listener\PruneDeletedTag;
use Ramon\Canela\Templates\TemplateIndex;
use Ramon\Canela\Templates\TemplatesSettings;

return [
    (new Extend\Settings())
        ->default(TemplatesSettings::ENABLED, true)
        ->serializeToForum('canelaTemplatesEnabled', TemplatesSettings::ENABLED, 'boolval')
        ->default(TemplateIndex::KEY, '[]'),

    // O índice é lido a cada serialização, e não por `serializeToForum`: ali o
    // valor é lido uma vez e fica preso no campo, e um processo que atende
    // várias requisições (os testes, um worker) serviria o índice antigo
    // depois de uma gravação.
    (new Extend\ApiResource(ForumResource::class))
        ->fields(static fn (): array => [
            Schema\Arr::make('canelaTemplates')
                ->get(static fn (): array => TemplateIndex::decode(resolve(SettingsRepositoryInterface::class)->get(TemplateIndex::KEY))),
        ]),

    new Extend\ApiResource(TemplateResource::class),

    // A tag apagada sai dos modelos (a tabela de ligação não tem chave
    // estrangeira para `tags`, que só existe com o flarum/tags).
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-tags', static fn (): array => [
            (new Extend\Event())
                ->listen(Deleting::class, PruneDeletedTag::class),
        ]),
];
