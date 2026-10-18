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

namespace Ramon\Canela\Ai\Helper;

/**
 * Os prompts do ajudante de IA do editor (o ✨ do Discourse): revisar,
 * traduzir, simplificar, explicar, gerar tabela, prompt personalizado,
 * sugerir títulos e sugerir categoria e etiquetas.
 *
 * O texto da pessoa vai sempre entre `<input>` e `</input>`: a instrução fica
 * no sistema e o texto nunca é lido como ordem — um post que diga "ignore as
 * instruções" é só texto a revisar.
 */
final class HelperPrompts
{
    /** Os modos que devolvem um texto novo, em streaming, para substituir o selecionado. */
    public const TEXT_MODES = ['proofread', 'translate', 'simplify', 'markdown_table', 'explain', 'custom_prompt'];

    /** Os modos que devolvem sugestões (JSON), sem streaming. */
    public const SUGGESTION_MODES = ['titles', 'tags'];

    /** O modelo rápido basta para estes; o resto usa o principal. */
    public const FAST_MODES = ['proofread', 'translate', 'simplify', 'markdown_table', 'titles', 'tags'];

    private const KEEP_FORMAT = 'Preserve o Markdown, os links, as menções (@nome), os emojis e as quebras de linha do original.';

    private const ONLY_RESULT = 'Responda somente com o resultado, sem comentários, sem explicações e sem as tags <input>.';

    public static function system(string $mode, string $language = '', string $customPrompt = '', string $context = ''): string
    {
        return match ($mode) {
            'proofread' => 'Você é um revisor de textos. Corrija a ortografia, a gramática e a pontuação do texto entre <input> e </input>, sem mudar o idioma, o tom nem o sentido. Não reescreva o que já está correto. '.self::KEEP_FORMAT.' '.self::ONLY_RESULT,
            'translate' => sprintf('Você é um tradutor. Traduza o texto entre <input> e </input> para %s, com naturalidade, mantendo o tom. Nomes próprios e trechos de código não se traduzem. %s %s', $language !== '' ? $language : 'português do Brasil', self::KEEP_FORMAT, self::ONLY_RESULT),
            'simplify' => 'Reescreva o texto entre <input> e </input> de forma mais simples, curta e clara, no mesmo idioma, sem perder nenhuma informação importante. '.self::KEEP_FORMAT.' '.self::ONLY_RESULT,
            'markdown_table' => 'Transforme o conteúdo entre <input> e </input> numa tabela em Markdown, com colunas que façam sentido para os dados, no mesmo idioma. '.self::ONLY_RESULT,
            'explain' => 'Explique o trecho entre <input> e </input> de forma clara e curta, para quem está lendo a discussão, no idioma do trecho. Explique termos, siglas e referências que um leitor pode não conhecer.'.($context !== '' ? ' Contexto: '.$context : '').' Responda em Markdown, sem repetir o trecho.',
            'custom_prompt' => 'Aplique ao texto entre <input> e </input> a instrução da pessoa, abaixo. '.self::KEEP_FORMAT.' '.self::ONLY_RESULT."\n\nInstrução: ".$customPrompt,
            'titles' => 'Sugira 5 títulos para uma discussão de fórum cujo conteúdo está entre <input> e </input>. Cada título deve ser claro, específico, com no máximo 12 palavras, no idioma do conteúdo. Responda com um título por linha, sem numeração, sem aspas e sem mais nada.',
            'tags' => 'Escolha, da lista de tags deste fórum, as que melhor classificam a discussão cujo conteúdo está entre <input> e </input>. Escolha no máximo 1 tag primária e até 3 tags secundárias, só as que se aplicam de verdade. Responda só com os ids escolhidos, separados por vírgula, ou com "nenhuma".'."\n\n".$context,
            default => '',
        };
    }

    public static function input(string $text): string
    {
        return "<input>\n".$text."\n</input>";
    }
}
