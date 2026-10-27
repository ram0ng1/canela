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
 *
 * Quem usa o bot, o ajudante e o "Perguntar à IA" (`canela.useAi`) e quem
 * gera resumos (`canela.generateAiSummaries`) se escolhe em Administração →
 * Permissões.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Ramon\Canela\Ai\Access\AiPermissionPolicy;
use Ramon\Canela\Ai\Access\ConversationPolicy;
use Ramon\Canela\Ai\Access\ScopeConversationVisibility;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Api\ConversationResource;
use Ramon\Canela\Ai\Api\DiscussionAiFields;
use Ramon\Canela\Ai\Api\ForumAiFields;
use Ramon\Canela\Ai\Api\MessageResource;
use Ramon\Canela\Ai\Api\TopicSummaryResource;
use Ramon\Canela\Ai\Console\EmbedTopicsCommand;
use Ramon\Canela\Ai\Console\GenerateGistsCommand;
use Ramon\Canela\Ai\Console\HourlySchedule;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Embeddings\RelatedTopicsEndpoint;
use Ramon\Canela\Ai\Helper\HelperController;
use Ramon\Canela\Ai\Http\AiPageContent;
use Ramon\Canela\Ai\Http\Conversations\ReplyController;
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
        ->fields(DiscussionAiFields::class)
        ->endpoints(static fn (): array => [RelatedTopicsEndpoint::endpoint()]),

    // As conversas com o bot (e as mensagens, só como inclusão) e os resumos
    // prontos dos tópicos.
    new Extend\ApiResource(ConversationResource::class),
    new Extend\ApiResource(MessageResource::class),
    new Extend\ApiResource(TopicSummaryResource::class),

    (new Extend\ModelVisibility(Conversation::class))
        ->scope(ScopeConversationVisibility::class),

    // Só a dona mexe na conversa; `canela.useAi` e `canela.generateAiSummaries`
    // juntam a permissão de grupo com o estado da IA.
    (new Extend\Policy())
        ->modelPolicy(Conversation::class, ConversationPolicy::class)
        ->globalPolicy(AiPermissionPolicy::class),

    (new Extend\Frontend('forum'))
        ->route('/ai/conversations', 'canela.ai.conversations', AiPageContent::class)
        ->route('/ai/conversations/{id:\d+}', 'canela.ai.conversation', AiPageContent::class),

    // O que responde em streaming (NDJSON) ou só chama o provedor fica em
    // controllers: a pergunta ao bot, o ajudante, a geração do resumo e o
    // "Testar conexão" do admin.
    (new Extend\Routes('api'))
        ->post('/canela/ai/conversations/reply', 'canela.ai.conversations.reply', ReplyController::class)
        ->post('/canela/ai/helper', 'canela.ai.helper', HelperController::class)
        ->post('/canela/ai/summaries/{id:\d+}', 'canela.ai.summaries.generate', SummaryController::class)
        ->post('/canela/ai/test', 'canela.ai.test', TestConnectionController::class),

    (new Extend\Console())
        ->command(GenerateGistsCommand::class)
        ->command(EmbedTopicsCommand::class)
        ->schedule(GenerateGistsCommand::class, HourlySchedule::class)
        ->schedule(EmbedTopicsCommand::class, HourlySchedule::class),
];
