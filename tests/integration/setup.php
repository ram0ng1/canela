<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Flarum\Testing\integration\Setup\Bootstrapper;
use Flarum\Testing\integration\Setup\SetupScript;
use Ramon\Canela\Tests\integration\RamonChatSchema;

require __DIR__.'/../../vendor/autoload.php';

$setup = new SetupScript();

$setup->run();

/*
 * Liga uma vez, antes da suíte, todas as extensões que os testes usam — o tema
 * por último, depois das tabelas do flarum/messages. Assim as migrations e o
 * esquema do tema nas mensagens (MessagesSchemaProvider) já estão no banco, e
 * nenhum teste roda DDL: no MySQL e no MariaDB o DDL confirma a transação do
 * teste, e o que ele gravou ficaria para os seguintes.
 */
$bootstrapper = new Bootstrapper(['env' => 'testing'], [
    'flarum-tags',
    'flarum-likes',
    'flarum-mentions',
    'flarum-sticky',
    'flarum-subscriptions',
    'flarum-lock',
    'flarum-approval',
    'flarum-flags',
    'flarum-suspend',
    'flarum-messages',
    'fof-pages',
    // Só para os testes da integração com o ramon/chat (src/RamonChat): as
    // tabelas dele já ficam prontas, e ligar a extensão num teste não roda DDL.
    // Fora no banco em que ele não instala (RamonChatSchema).
    ...(RamonChatSchema::unsupportedReason() === null ? ['ramon-chat'] : []),
    'ramon-canela',
]);

$bootstrapper->run()->bootApp();

try {
    $bootstrapper->database?->rollBack();
} catch (Throwable) {
    // O DDL do MySQL já encerrou a transação.
}

echo "Extensions migrated\n";
