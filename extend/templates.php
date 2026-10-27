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

use Flarum\Extend;
use Flarum\Tags\Event\Deleting;
use Ramon\Canela\Templates\Api\TemplateResource;
use Ramon\Canela\Templates\Listener\PruneDeletedTag;
use Ramon\Canela\Templates\TemplateIndex;
use Ramon\Canela\Templates\TemplatesSettings;

return [
    (new Extend\Settings())
        ->default(TemplatesSettings::ENABLED, true)
        ->serializeToForum('canelaTemplatesEnabled', TemplatesSettings::ENABLED, 'boolval')
        ->default(TemplateIndex::KEY, '[]')
        ->serializeToForum('canelaTemplates', TemplateIndex::KEY, static fn (mixed $value): array => TemplateIndex::decode($value)),

    new Extend\ApiResource(TemplateResource::class),

    // A tag apagada sai dos modelos (a tabela de ligação não tem chave
    // estrangeira para `tags`, que só existe com o flarum/tags).
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-tags', static fn (): array => [
            (new Extend\Event())
                ->listen(Deleting::class, PruneDeletedTag::class),
        ]),
];
