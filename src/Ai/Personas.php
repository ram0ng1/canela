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

namespace Ramon\Canela\Ai;

use Flarum\Locale\TranslatorInterface;

/**
 * As personas do bot (os "agentes"): nome, descrição, prompt de
 * sistema e as ferramentas que cada uma pode usar.
 *
 * Moram numa configuração (`canela.ai_personas`, JSON) editada no admin; vazia,
 * valem as padrões:
 * Ajudante do fórum, Pesquisador do Fórum, Criativa e Pesquisador da Web (esta
 * desligada: cada busca na web é cobrada à parte pelo provedor).
 *
 * @phpstan-type Persona array{id: string, name: string, description: string, prompt: string, search: bool, read: bool, web: bool, enabled: bool}
 */
final class Personas
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /**
     * @return list<Persona>
     */
    public function all(): array
    {
        $stored = json_decode($this->settings->string(AiSettings::PERSONAS), true);

        if (! is_array($stored) || $stored === []) {
            return $this->defaults();
        }

        $personas = [];

        foreach ($stored as $item) {
            if (! is_array($item)) {
                continue;
            }

            $persona = self::normalize($item);

            if ($persona['id'] !== '' && $persona['name'] !== '') {
                $personas[] = $persona;
            }
        }

        return $personas !== [] ? $personas : $this->defaults();
    }

    /**
     * @return list<Persona>
     */
    public function enabled(): array
    {
        return array_values(array_filter($this->all(), static fn (array $persona): bool => $persona['enabled']));
    }

    /**
     * A persona pedida, ou a padrão do admin, ou a primeira ligada.
     *
     * @return Persona|null
     */
    public function find(?string $id): ?array
    {
        $enabled = $this->enabled();

        foreach ([$id, $this->settings->string(AiSettings::DEFAULT_PERSONA)] as $wanted) {
            foreach ($enabled as $persona) {
                if ($wanted !== null && $persona['id'] === $wanted) {
                    return $persona;
                }
            }
        }

        return $enabled[0] ?? null;
    }

    /**
     * @return list<Persona>
     */
    public function defaults(): array
    {
        $t = fn (string $key): string => $this->translator->trans('ramon-canela.api.ai.personas.'.$key);

        return [
            [
                'id' => 'general',
                'name' => $t('general_name'),
                'description' => $t('general_description'),
                'prompt' => $t('general_prompt'),
                'search' => true,
                'read' => true,
                'web' => false,
                'enabled' => true,
            ],
            [
                'id' => 'forum_researcher',
                'name' => $t('forum_researcher_name'),
                'description' => $t('forum_researcher_description'),
                'prompt' => $t('forum_researcher_prompt'),
                'search' => true,
                'read' => true,
                'web' => false,
                'enabled' => true,
            ],
            [
                'id' => 'creative',
                'name' => $t('creative_name'),
                'description' => $t('creative_description'),
                'prompt' => $t('creative_prompt'),
                'search' => false,
                'read' => false,
                'web' => false,
                'enabled' => true,
            ],
            [
                'id' => 'researcher',
                'name' => $t('researcher_name'),
                'description' => $t('researcher_description'),
                'prompt' => $t('researcher_prompt'),
                'search' => false,
                'read' => false,
                'web' => true,
                'enabled' => false,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $item
     *
     * @return Persona
     */
    public static function normalize(array $item): array
    {
        $id = strtolower((string) preg_replace('/[^a-z0-9_-]/i', '', (string) ($item['id'] ?? '')));

        return [
            'id' => substr($id, 0, 50),
            'name' => mb_substr(trim((string) ($item['name'] ?? '')), 0, 80),
            'description' => mb_substr(trim((string) ($item['description'] ?? '')), 0, 300),
            'prompt' => mb_substr(trim((string) ($item['prompt'] ?? '')), 0, 20000),
            'search' => (bool) ($item['search'] ?? false),
            'read' => (bool) ($item['read'] ?? false),
            'web' => (bool) ($item['web'] ?? false),
            'enabled' => (bool) ($item['enabled'] ?? true),
        ];
    }
}
