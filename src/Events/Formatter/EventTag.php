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

namespace Ramon\Canela\Events\Formatter;

use s9e\TextFormatter\Configurator;

/**
 * O evento no primeiro post:
 *
 *     [event name="Encontro" start="2026-10-30 10:00" end="2026-10-30 11:00"
 *            timezone="America/Sao_Paulo" recurrence="every_two_weeks"
 *            url="https://…" chat="true"]
 *     A descrição, com markdown.
 *     [/event]
 *
 * O composer monta o código pelo botão "Criar evento". O servidor guarda os
 * dados na tabela `canela_events` (Listener\SyncPostEvent), e o fórum troca o
 * bloco pelo cartão do evento (presença, convidados, agenda). Sem JavaScript,
 * fica o nome, as datas e a descrição.
 */
final class EventTag
{
    /** A tag do XML (o nome do BBCode). */
    public const NAME = 'EVENT';

    /** As recorrências aceitas. */
    public const RECURRENCES = ['every_day', 'every_weekday', 'every_week', 'every_two_weeks', 'every_four_weeks', 'every_month'];

    /** "Público" tem presença; "standalone" é só o aviso, sem presença. */
    public const STATUSES = ['public', 'standalone'];

    public function __invoke(Configurator $config): void
    {
        if (isset($config->tags[self::NAME])) {
            return;
        }

        // Sem espaço literal na expressão: o BBCodes separa os atributos da
        // definição por espaço (o \x20 é o espaço entre a data e a hora).
        $date = '/^\d{4}-\d{2}-\d{2}(?:[T\x20]\d{1,2}:\d{2})?$/';

        $config->BBCodes->addCustom(
            '[EVENT'
            .' name={TEXT1;optional}'
            .' start={REGEXP1='.$date.'}'
            .' end={REGEXP2='.$date.';optional}'
            .' timezone={REGEXP3=/^[A-Za-z0-9_+\-\/]{1,64}$/;optional}'
            .' status={CHOICE1='.implode(',', self::STATUSES).';optional}'
            .' recurrence={CHOICE2='.implode(',', self::RECURRENCES).';optional}'
            .' until={REGEXP4=/^\d{4}-\d{2}-\d{2}$/;optional}'
            .' url={URL;optional}'
            .' location={TEXT2;optional}'
            .' max={UINT;optional}'
            .' chat={CHOICE3=true,false;optional}'
            .']',
            '<div class="CanelaEvent" data-name="{TEXT1}" data-start="{REGEXP1}" data-end="{REGEXP2}" data-timezone="{REGEXP3}" data-status="{CHOICE1}" data-recurrence="{CHOICE2}" data-until="{REGEXP4}" data-url="{URL}" data-location="{TEXT2}" data-max="{UINT}" data-chat="{CHOICE3}">'
            .'<div class="CanelaEvent-fallback"><strong>{TEXT1}</strong> <span>{REGEXP1}<xsl:if test="@end"> → {REGEXP2}</xsl:if><xsl:if test="@timezone"> ({REGEXP3})</xsl:if></span></div>'
            .'<div class="CanelaEvent-description"><xsl:apply-templates/></div>'
            .'</div>'
        );
    }
}
