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

namespace Ramon\Canela\Preload;

use Flarum\Frontend\Document;

/**
 * Tira do HTML do fórum os atributos do fórum que só o admin lê.
 *
 * Alguns atributos existem só para o painel (as personas padrão da IA, se as
 * tabelas da IA existem, o que os emblemas conseguem medir) e já são visíveis
 * só para administradores. Mas o documento do fórum é o mesmo `GET /api` nos
 * dois frontends, então todo administrador levava ~1,6 kB a mais em cada
 * página do fórum, que o JS do fórum nunca lê. Aqui eles saem do documento
 * antes de o core montar o payload (prioridade acima da do `CorePayload`); o
 * admin e o `GET /api` continuam recebendo tudo.
 */
final class AdminOnlyForumAttributes
{
    /** Prioridade do conteúdo: depois do documento, antes do `CorePayload` (180). */
    public const PRIORITY = 185;

    /** Lidos só em `js/src/admin` (ai.tsx, badges.tsx). */
    private const ATTRIBUTES = ['canelaAiDefaultPersonas', 'canelaAiSchemaReady', 'canelaBadgesCapabilities'];

    public function __invoke(Document $document): void
    {
        $forum = $document->getForumApiDocument();

        if (! isset($forum['data']['attributes']) || ! is_array($forum['data']['attributes'])) {
            return;
        }

        foreach (self::ATTRIBUTES as $attribute) {
            unset($forum['data']['attributes'][$attribute]);
        }

        $document->setForumApiDocument($forum);
    }
}
