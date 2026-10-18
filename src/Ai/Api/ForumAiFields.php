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

namespace Ramon\Canela\Ai\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Personas;
use Ramon\Canela\Ai\UsageLimiter;

/**
 * O que o fórum precisa saber da IA, para quem está vendo (`canelaAi`):
 * quais recursos valem, se a pessoa pode usar o bot e gerar resumos, as
 * personas e quantos pedidos ainda restam hoje.
 *
 * Sem provedor configurado (ou desligada, ou sem as tabelas), o campo é null
 * e nada de IA aparece no fórum. Nenhuma chave de API sai daqui.
 *
 * Para o admin vão também as personas padrão (`canelaAiDefaultPersonas`):
 * o editor de personas parte delas quando a configuração está vazia.
 */
final class ForumAiFields
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly Personas $personas,
        private readonly UsageLimiter $usage,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaAi')
                ->nullable()
                ->get(fn (object $forum, Context $context): ?array => $this->payload($context)),

            Schema\Arr::make('canelaAiDefaultPersonas')
                ->visible(static fn (object $forum, Context $context): bool => $context->getActor()->isAdmin())
                ->get(fn (): array => $this->personas->defaults()),

            Schema\Boolean::make('canelaAiSchemaReady')
                ->visible(static fn (object $forum, Context $context): bool => $context->getActor()->isAdmin())
                ->get(fn (): bool => $this->settings->schemaReady()),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function payload(Context $context): ?array
    {
        if (! $this->settings->available()) {
            return null;
        }

        $actor = $context->getActor();
        $canUse = $this->settings->canUse($actor);

        return [
            'bot' => $this->settings->bool(AiSettings::BOT),
            'botHeaderIcon' => $this->settings->bool(AiSettings::BOT_HEADER),
            'botSidebarLink' => $this->settings->bool(AiSettings::BOT_SIDEBAR),
            'search' => $this->settings->bool(AiSettings::SEARCH) && $this->settings->bool(AiSettings::BOT),
            'helper' => $this->settings->bool(AiSettings::HELPER),
            'summary' => $this->settings->bool(AiSettings::SUMMARY),
            'gists' => $this->settings->bool(AiSettings::GISTS),
            'related' => $this->settings->feature(AiSettings::RELATED),
            'canUse' => $canUse,
            'canSummarize' => $this->settings->canSummarize($actor),
            'remaining' => $canUse ? $this->usage->remaining($actor) : null,
            'personas' => $canUse ? array_map(static fn (array $persona): array => [
                'id' => $persona['id'],
                'name' => $persona['name'],
                'description' => $persona['description'],
            ], $this->personas->enabled()) : [],
            'defaultPersona' => $canUse ? ($this->personas->find(null)['id'] ?? null) : null,
            'model' => $this->settings->mainModel(),
        ];
    }
}
