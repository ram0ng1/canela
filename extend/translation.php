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
 * Tradução automática do conteúdo (o `ai_translation` do Discourse AI): cada
 * postagem e título lidos num idioma diferente do de quem lê são traduzidos
 * pela IA na primeira leitura e guardados; o fórum mostra o 文A ao lado da data
 * para alternar com o original.
 *
 * Usa o provedor e as configurações do recurso `ai` (src/Ai), mas fica num
 * arquivo próprio para entrar no `.enabled` só depois de testado. Desligada
 * (ou sem IA configurada, ou sem as tabelas), os campos nem aparecem e a rota
 * responde 404.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Extend;
use Ramon\Canela\Ai\Translation\Api\TranslationFields;
use Ramon\Canela\Ai\Translation\Listener\ForgetTranslations;
use Ramon\Canela\Ai\Translation\TranslateController;

return [
    (new Extend\ApiResource(ForumResource::class))
        ->fields(static fn (): array => resolve(TranslationFields::class)->forum()),

    (new Extend\ApiResource(PostResource::class))
        ->fields(static fn (): array => resolve(TranslationFields::class)->post()),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(static fn (): array => resolve(TranslationFields::class)->discussion()),

    (new Extend\Routes('api'))
        ->post('/canela/ai/translate', 'canela.ai.translate', TranslateController::class),

    (new Extend\Event())
        ->subscribe(ForgetTranslations::class),

    // "Preferências de idioma do conteúdo" (o modal do 文A da linha do tempo):
    // os idiomas que a pessoa lê sem tradução e se a tradução é automática.
    (new Extend\User())
        ->registerPreference('canelaUnderstoodLocales', static function ($value): array {
            if (! is_array($value)) {
                return [];
            }

            $codes = [];

            foreach ($value as $code) {
                // Códigos BCP 47 curtos ("pt", "pt-BR", "zh-Hans"): nada além disso.
                if (is_string($code) && preg_match('/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8}){0,2}$/', $code)) {
                    $codes[] = str_replace('_', '-', $code);
                }
            }

            return array_slice(array_values(array_unique($codes)), 0, 30);
        }, [])
        ->registerPreference('canelaAutoTranslate', 'boolval', true),
];
