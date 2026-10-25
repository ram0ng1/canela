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

namespace Ramon\Canela\Cooked\Formatter;

use s9e\TextFormatter\Configurator;

/**
 * As notas de rodapé:
 *
 *     Texto com nota[^1] e uma nota em linha^[direto aqui].
 *
 *     [^1]: O texto da nota, com **markdown**.
 *
 * O Litedown do Flarum não tem essa sintaxe, então cada pedaço vira uma
 * marca: a referência `[^1]` (um <sup> com o rótulo), o começo da definição
 * `[^1]: ` (um <span> vazio no lugar do rótulo, e o resto da linha continua
 * markdown normal) e a nota em linha `^[texto]` (o texto num atributo). O
 * fórum (gaps/cooked/footnotes.ts) numera as referências pela ordem, esconde
 * as definições e abre a nota numa dica no clique. Sem JavaScript fica legível:
 * "nota[1]" e "[1]: texto".
 *
 * As marcas não entram em código (o Litedown ignora o que está dentro de
 * `code`/blocos), e valem a partir do próximo "limpar cache".
 */
final class Footnotes
{
    /** O rótulo: letras, números, "_" e "-". */
    private const LABEL = '[\w-]{1,30}';

    public function __invoke(Configurator $config): void
    {
        if (isset($config->tags['CNFNREF'])) {
            return;
        }

        // A referência no meio do texto (e não o começo de uma definição).
        $config->Preg->replace(
            '/\[\^('.self::LABEL.')\](?!:)/',
            '<sup class="CanelaFootnote-ref" data-fn="$1"><a href="#cn-fn-$1">[$1]</a></sup>',
            'CNFNREF'
        );

        // O começo da definição, só no início da linha.
        $config->Preg->replace(
            '/^\[\^('.self::LABEL.')\]:[ \t]?/m',
            '<span class="CanelaFootnote-def" data-fn="$1">[$1]: </span>',
            'CNFNDEF'
        );

        // A nota em linha: ^[texto], sem quebra de linha e sem "]" dentro.
        $config->Preg->replace(
            '/\^\[([^\]\n]{1,500})\]/',
            '<span class="CanelaFootnote-inline" data-text="$1"><sup>*</sup></span>',
            'CNFNINLINE'
        );
    }
}
