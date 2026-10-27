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

/**
 * Os campos de um modelo de formulário: o que está entre `{{` e `}}` no texto.
 *
 * O texto é a referência. A lista de campos é refeita a partir dele a cada
 * gravação (TemplateResource::saving), na ordem em que os campos aparecem,
 * com o que o admin configurou de cada um (rótulo, tipo, dica, opções,
 * obrigatório) e o padrão para o que faltar. Um campo que não está no texto
 * sai; o que o cliente mande a mais dentro de um campo também.
 *
 * O fórum preenche o texto com o mesmo contrato (js/src/common/templates.ts).
 */
final class TemplateFields
{
    public const MAX_BODY = 20000;

    public const MAX_KEY = 60;

    public const MAX_LABEL = 100;

    public const MAX_TEXT = 500;

    public const MAX_OPTIONS = 50;

    public const TYPES = ['text', 'textarea', 'select'];

    /**
     * As chaves dos campos, sem repetir, na ordem em que aparecem no texto.
     *
     * @return list<string>
     */
    public static function placeholders(string $body): array
    {
        preg_match_all('/\{\{\s*([^{}\r\n]{1,'.self::MAX_KEY.'}?)\s*\}\}/u', $body, $matches);

        $keys = [];

        foreach ($matches[1] as $key) {
            $key = trim($key);

            if ($key !== '' && ! in_array($key, $keys, true)) {
                $keys[] = $key;
            }
        }

        return $keys;
    }

    /**
     * A lista final de campos: um por chave do texto, com a configuração que
     * chegou para ela (procurada pela `key`) ou o padrão.
     *
     * @param  mixed $fields o que a API recebeu
     * @return list<array{key: string, label: string, type: string, placeholder: string, description: string, required: bool, options: list<string>}>
     */
    public static function normalize(mixed $fields, string $body): array
    {
        $given = [];

        if (is_array($fields)) {
            foreach ($fields as $field) {
                if (is_array($field) && is_string($field['key'] ?? null)) {
                    $given[trim($field['key'])] = $field;
                }
            }
        }

        $out = [];

        foreach (self::placeholders($body) as $key) {
            $field = $given[$key] ?? [];
            $type = in_array($field['type'] ?? null, self::TYPES, true) ? $field['type'] : 'text';

            $out[] = [
                'key' => $key,
                'label' => self::text($field['label'] ?? '', self::MAX_LABEL) ?: $key,
                'type' => $type,
                'placeholder' => self::text($field['placeholder'] ?? '', self::MAX_TEXT),
                'description' => self::text($field['description'] ?? '', self::MAX_TEXT),
                'required' => filter_var($field['required'] ?? false, FILTER_VALIDATE_BOOL),
                'options' => $type === 'select' ? self::options($field['options'] ?? null) : [],
            ];
        }

        return $out;
    }

    /**
     * As opções de uma lista: textos aparados, sem vazios nem repetidos.
     *
     * @return list<string>
     */
    private static function options(mixed $raw): array
    {
        $options = [];

        foreach (is_array($raw) ? $raw : [] as $option) {
            $option = self::text($option, self::MAX_LABEL);

            if ($option !== '' && ! in_array($option, $options, true)) {
                $options[] = $option;
            }

            if (count($options) >= self::MAX_OPTIONS) {
                break;
            }
        }

        return $options;
    }

    /** O texto aparado e cortado no tamanho; o que não é texto vira vazio. */
    private static function text(mixed $value, int $max): string
    {
        if (! is_scalar($value)) {
            return '';
        }

        $value = trim((string) $value);

        return mb_strlen($value) > $max ? mb_substr($value, 0, $max) : $value;
    }
}
