<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Flarum\Database\Migration;

/*
 * Sal do hash que identifica visitantes nas visualizações. Sem ele, o hash de
 * um IPv4 se desfaz por força bruta em minutos (são só 4 bilhões de IPs); com
 * um sal aleatório por fórum, a tabela não revela de onde vieram os acessos.
 * Gerado uma vez, na migração, e nunca enviado ao navegador.
 */
return Migration::addSettings([
    'canela.stats_visitor_salt' => bin2hex(random_bytes(16)),
]);
