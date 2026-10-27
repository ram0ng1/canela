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

namespace Ramon\Canela\Templates;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;

/**
 * O resumo dos modelos que o fórum recebe em toda página (`canelaTemplates`):
 * id, nome, tipo, se é obrigatório e as tags de cada um, sem o texto.
 *
 * Fica numa configuração (self::KEY), refeita quando um modelo ou uma tag
 * muda: o fórum não consulta a tabela a cada página, e o payload não cresce
 * com o tamanho dos textos. O texto e os campos de um modelo descem pela API
 * quando ele é escolhido no composer.
 */
final class TemplateIndex
{
    public const KEY = 'canela.templates_index';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ConnectionInterface $db,
    ) {
    }

    /** Refaz o índice a partir da tabela (e da tabela de ligação com as tags). */
    public function rebuild(): void
    {
        $tags = [];

        foreach ($this->db->table(Template::PIVOT)->orderBy('tag_id')->get(['template_id', 'tag_id']) as $row) {
            $tags[(int) $row->template_id][] = (int) $row->tag_id;
        }

        $index = [];

        foreach (Template::query()->orderBy('position')->orderBy('name')->orderBy('id')->get(['id', 'name', 'kind', 'required']) as $template) {
            $index[] = [
                'id' => $template->id,
                'name' => $template->name,
                'kind' => $template->kind,
                'required' => $template->required,
                'tags' => $tags[$template->id] ?? [],
            ];
        }

        $this->settings->set(self::KEY, json_encode($index, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }

    /**
     * O índice guardado, já conferido: uma entrada sem a forma esperada sai.
     *
     * @return list<array{id: int, name: string, kind: string, required: bool, tags: list<int>}>
     */
    public static function decode(mixed $raw): array
    {
        if (! is_string($raw) || $raw === '') {
            return [];
        }

        try {
            $data = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (! is_array($data)) {
            return [];
        }

        $out = [];

        foreach ($data as $entry) {
            if (! is_array($entry) || ! is_numeric($entry['id'] ?? null) || ! is_string($entry['name'] ?? null)) {
                continue;
            }

            $tags = [];

            foreach (is_array($entry['tags'] ?? null) ? $entry['tags'] : [] as $tag) {
                if (is_numeric($tag)) {
                    $tags[] = (int) $tag;
                }
            }

            $out[] = [
                'id' => (int) $entry['id'],
                'name' => $entry['name'],
                'kind' => in_array($entry['kind'] ?? null, Template::KINDS, true) ? $entry['kind'] : 'text',
                'required' => (bool) ($entry['required'] ?? false),
                'tags' => $tags,
            ];
        }

        return $out;
    }
}
