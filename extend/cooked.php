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
 * A sintaxe a mais no conteúdo dos posts:
 *
 * - notas de rodapé (`[^1]`, `[^1]: …` e `^[…]`);
 * - o marcador do sumário `[toc]`.
 *
 * A sintaxe fica sempre registrada (o formatador é montado uma vez e guardado
 * em cache); as chaves do admin ligam o que o fórum faz com ela: numerar as
 * notas e abrir a dica, mostrar o sumário. Desligadas, as notas ficam como
 * "[1]" e "[1]: texto", e o [toc] some.
 */

use Flarum\Extend;
use Ramon\Canela\Cooked\Formatter\Footnotes;
use Ramon\Canela\Cooked\Formatter\TableOfContents;

return [
    (new Extend\Formatter())
        ->configure(static function (s9e\TextFormatter\Configurator $config): void {
            (new Footnotes())($config);
            (new TableOfContents())($config);
        }),

    (new Extend\Settings())
        ->default('canela.footnotes', true)
        ->default('canela.toc', true)
        ->default('canela.toc_min_headings', 3)
        ->default('canela.toc_auto_tags', '')
        // O fórum só mostra os botões do composer com a sintaxe registrada.
        ->default('canela.cooked_backend', true)
        ->serializeToForum('canelaCookedBackend', 'canela.cooked_backend', static fn (): bool => true)
        ->serializeToForum('canelaFootnotes', 'canela.footnotes', 'boolval')
        ->serializeToForum('canelaToc', 'canela.toc', 'boolval')
        ->serializeToForum('canelaTocMinHeadings', 'canela.toc_min_headings', 'intval')
        ->serializeToForum('canelaTocAutoTags', 'canela.toc_auto_tags', 'strval'),
];
