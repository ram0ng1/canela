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

namespace Ramon\Canela\Gaps\Formatter;

use s9e\TextFormatter\Configurator;

/**
 * As datas locais do Discourse (discourse-local-dates):
 *
 *     [date=2026-10-20 time=14:00 timezone="America/Sao_Paulo"]
 *
 * vira um <span> com a data, a hora e o fuso de quem escreveu; o fórum
 * mostra a mesma hora no fuso de quem lê ("20 out 2026, 14:00") e, no
 * título, a hora original. Sem JavaScript fica o texto escrito.
 *
 * A configuração do formatador vale a partir do próximo "limpar cache";
 * postagens antigas guardam o texto como estava.
 */
final class LocalDates
{
    public function __invoke(Configurator $config): void
    {
        if (isset($config->tags['DATE'])) {
            return;
        }

        $config->BBCodes->addCustom(
            '[DATE={REGEXP1=/^\d{4}-\d{2}-\d{2}$/} time={REGEXP2=/^\d{1,2}:\d{2}(?::\d{2})?$/;optional} timezone={REGEXP3=/^[A-Za-z0-9_+\-\/]{1,64}$/;optional}]',
            '<span class="canela-local-date" data-date="{REGEXP1}" data-time="{REGEXP2}" data-timezone="{REGEXP3}">{REGEXP1}<xsl:if test="@time"> {REGEXP2}</xsl:if><xsl:if test="@timezone"> ({REGEXP3})</xsl:if></span>'
        );

        // Como no Discourse, a tag não tem fechamento: [date=…] e pronto.
        $config->tags['DATE']->rules->autoClose();
    }
}
