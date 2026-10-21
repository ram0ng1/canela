<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * IA: bot de conversas com busca no
 * fórum, "Perguntar à IA" na busca, resumo do tópico e resumos curtos na
 * lista, ajudante de IA no editor e tópicos relacionados por embeddings.
 *
 * O provedor (Anthropic por padrão, ou qualquer API compatível com a da
 * OpenAI) e as chaves ficam nas configurações, e só o PHP as lê: nenhuma
 * chave vai para o fórum, e toda chamada ao modelo sai do servidor.
 *
 * Tudo fica registrado mesmo com a IA desligada — as rotas da API são montadas
 * no boot, antes das configurações —, e cada ponto de entrada consulta
 * AiSettings: desligada, sem chave ou sem as tabelas, as rotas respondem 404 e
 * o fórum não mostra nada.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Api\DiscussionAiFields;
use Ramon\Canela\Ai\Api\ForumAiFields;
use Ramon\Canela\Ai\Console\EmbedTopicsCommand;
use Ramon\Canela\Ai\Console\GenerateGistsCommand;
use Ramon\Canela\Ai\Console\HourlySchedule;
use Ramon\Canela\Ai\Embeddings\RelatedController;
use Ramon\Canela\Ai\Helper\HelperController;
use Ramon\Canela\Ai\Http\AiPageContent;
use Ramon\Canela\Ai\Http\Conversations\ListConversationsController;
use Ramon\Canela\Ai\Http\Conversations\ReplyController;
use Ramon\Canela\Ai\Http\Conversations\ShowConversationController;
use Ramon\Canela\Ai\Http\Conversations\UpdateConversationController;
use Ramon\Canela\Ai\Http\TestConnectionController;
use Ramon\Canela\Ai\Summaries\SummaryController;

// O extend.php principal faz `require` deste arquivo numa closure própria, mas
// o padrão dos outros recursos é não deixar variável solta: tudo numa função.
$aiSettings = (static function (): Extend\Settings {
    $settings = new Extend\Settings();

    // Só os padrões: o fórum recebe o estado da IA pelo campo `canelaAi` do
    // ForumResource (por pessoa: grupos, limite, personas), nunca as chaves.
    foreach (AiSettings::defaults() as $key => $default) {
        $settings->default($key, $default);
    }

    return $settings;
})();

return [
    $aiSettings,

    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumAiFields::class),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionAiFields::class),

    (new Extend\Frontend('forum'))
        ->route('/ai/conversations', 'canela.ai.conversations', AiPageContent::class)
        ->route('/ai/conversations/{id:\d+}', 'canela.ai.conversation', AiPageContent::class),

    (new Extend\Routes('api'))
        ->get('/canela/ai/conversations', 'canela.ai.conversations.index', ListConversationsController::class)
        ->post('/canela/ai/conversations/reply', 'canela.ai.conversations.reply', ReplyController::class)
        ->get('/canela/ai/conversations/{id:\d+}', 'canela.ai.conversations.show', ShowConversationController::class)
        ->patch('/canela/ai/conversations/{id:\d+}', 'canela.ai.conversations.update', UpdateConversationController::class)
        ->delete('/canela/ai/conversations/{id:\d+}', 'canela.ai.conversations.delete', UpdateConversationController::class)
        ->post('/canela/ai/helper', 'canela.ai.helper', HelperController::class)
        ->get('/canela/ai/summaries/{id:\d+}', 'canela.ai.summaries.show', SummaryController::class)
        ->post('/canela/ai/summaries/{id:\d+}', 'canela.ai.summaries.generate', SummaryController::class)
        ->get('/canela/ai/related/{id:\d+}', 'canela.ai.related', RelatedController::class)
        ->post('/canela/ai/test', 'canela.ai.test', TestConnectionController::class),

    (new Extend\Console())
        ->command(GenerateGistsCommand::class)
        ->command(EmbedTopicsCommand::class)
        ->schedule(GenerateGistsCommand::class, HourlySchedule::class)
        ->schedule(EmbedTopicsCommand::class, HourlySchedule::class),
];
