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

namespace Ramon\Canela\BugReports;

/**
 * As instruções para colar numa IA (ChatGPT, Claude, Gemini, um agente no
 * editor…): o papel dela, o passo a passo (reproduzir, escrever o teste,
 * corrigir, verificar, responder), o ambiente do fórum e os relatórios.
 *
 * Em português para fóruns em português e em inglês para os demais; a IA
 * lê os dois, a escolha é para quem copia conseguir revisar o texto.
 */
final class AiPrompt
{
    /**
     * @param array{title: string, url: string, flarum: string, theme: string, extensions: list<string>} $forum
     */
    public static function header(array $forum, int $count, bool $portuguese): string
    {
        $extensions = $forum['extensions'] ? implode(', ', $forum['extensions']) : '—';

        if ($portuguese) {
            return implode("\n", [
                '# Corrigir '.($count === 1 ? 'um problema relatado' : $count.' problemas relatados').' — '.$forum['title'],
                '',
                'Você é um desenvolvedor experiente em Flarum 2 (PHP 8 e Mithril/TypeScript). As pessoas deste fórum marcaram na tela o que está errado; cada relatório abaixo traz a descrição, a página, o tamanho da tela, os elementos HTML sob a área marcada e as capturas.',
                '',
                '## Como trabalhar',
                '',
                '1. **Reproduza antes de mudar qualquer coisa.** Abra a URL com a mesma largura e altura de tela (e o mesmo tema, claro ou escuro), siga a descrição e confirme o problema. Compare com as capturas.',
                '2. **Ache o código.** Os "elementos sob a área" trazem as classes do HTML. Classes que começam com `Canela` são do tema `ramon/canela` (`js/src`, `less/`, `src/`); as demais são do core do Flarum ou de uma das extensões listadas. Procure a classe no código, não adivinhe.',
                '3. **Escreva primeiro um teste que falhe por causa do problema**: um teste unitário (PHPUnit ou TypeScript) ou um teste de navegador (Playwright) na mesma URL e no mesmo tamanho de tela. Só então corrija.',
                '4. **Corrija a causa, não o sintoma.** Mudança pequena, no estilo do código em volta. Não mexa no que não tem a ver com o relatório.',
                '5. **Verifique.** Rode o teste novo e os que já existem, o lint e a checagem de tipos, e confira na mesma tela que o problema sumiu (antes e depois).',
                '6. **Responda**, para cada relatório: a causa, o que mudou (arquivos), como testou e uma frase simples para quem reportou (vai no campo "Resposta para quem reportou" do painel).',
                '',
                'Se não conseguir reproduzir, diga o que tentou e o que falta saber. Não invente uma correção.',
                '',
                '## Ambiente',
                '',
                '- Fórum: '.$forum['url'],
                '- Flarum '.$forum['flarum'].', tema ramon/canela '.$forum['theme'],
                '- Extensões ativas: '.$extensions,
                '- As capturas abrem pelos links abaixo, sem login, por 7 dias. Se você não consegue abrir links, peça que colem as imagens.',
                '',
            ]);
        }

        return implode("\n", [
            '# Fix '.($count === 1 ? 'a reported problem' : $count.' reported problems').' — '.$forum['title'],
            '',
            'You are an experienced Flarum 2 developer (PHP 8 and Mithril/TypeScript). People on this forum marked what is wrong on their screen; each report below has the description, the page, the screen size, the HTML elements under the marked area and the screenshots.',
            '',
            '## How to work',
            '',
            '1. **Reproduce before changing anything.** Open the URL at the same screen width and height (and the same light or dark theme), follow the description and confirm the problem. Compare with the screenshots.',
            '2. **Find the code.** The "elements under the area" list the HTML classes. Classes starting with `Canela` belong to the `ramon/canela` theme (`js/src`, `less/`, `src/`); the others come from Flarum core or one of the extensions listed. Search for the class in the code; do not guess.',
            '3. **First write a test that fails because of the problem**: a unit test (PHPUnit or TypeScript) or a browser test (Playwright) on the same URL and screen size. Only then fix it.',
            '4. **Fix the cause, not the symptom.** Keep the change small and in the style of the surrounding code. Do not touch what is unrelated to the report.',
            '5. **Verify.** Run the new test and the existing ones, lint and type checks, and check on the same screen that the problem is gone (before and after).',
            '6. **Reply**, for each report: the cause, what changed (files), how you tested it and one plain sentence for the reporter (it goes in the "Reply to the reporter" field of the panel).',
            '',
            'If you cannot reproduce it, say what you tried and what is missing. Do not invent a fix.',
            '',
            '## Environment',
            '',
            '- Forum: '.$forum['url'],
            '- Flarum '.$forum['flarum'].', ramon/canela theme '.$forum['theme'],
            '- Enabled extensions: '.$extensions,
            '- Screenshots open from the links below without login, for 7 days. If you cannot open links, ask for the images to be pasted.',
            '',
        ]);
    }
}
