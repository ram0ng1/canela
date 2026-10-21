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

namespace Ramon\Canela\System\Messages;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Str;

/**
 * As mensagens automáticas que o admin cria (além das padrão): um
 * título, um gatilho e o assunto e o texto, guardados em JSON em
 * `canela.sysmsg_custom`. Cada uma sai uma vez só por pessoa.
 *
 * Gatilhos:
 * - `activated`: a conta foi ativada; com `delay` dias, sai esse tempo depois
 *   (pelo agendador), só para quem se cadastrou depois de a mensagem existir;
 * - `group`: entrou no grupo `value`;
 * - `trust_level`: chegou ao nível de confiança `value`;
 * - `badge`: ganhou o emblema `value`;
 * - `first_post`: publicou a primeira postagem;
 * - `verified`: a conta foi verificada pela equipe (extensão ramon/verified);
 * - `anniversary`: a conta fez `value` anos (pelo agendador; só aniversários
 *   que caem depois de a mensagem existir).
 *
 * @phpstan-type Entry array{id: string, title: string, enabled: bool, trigger: string, value: int|null, delay: int, subject: string, body: string, createdAt: string}
 */
final class CustomMessages
{
    public const SETTING = 'canela.sysmsg_custom';

    public const TRIGGERS = ['activated', 'group', 'trust_level', 'badge', 'first_post', 'verified', 'anniversary'];

    /** Gatilhos que escolhem um item (o grupo, o nível, o emblema). */
    public const WITH_VALUE = ['group', 'trust_level', 'badge', 'anniversary'];

    public const MAX_YEARS = 50;

    public const MAX = 30;

    public const MAX_DELAY_DAYS = 365;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /** @return list<Entry> */
    public function all(): array
    {
        return self::parse((string) $this->settings->get(self::SETTING, '[]'));
    }

    /**
     * As mensagens ligadas de um gatilho (e do item dele, quando tem).
     *
     * @return list<Entry>
     */
    public function for(string $trigger, ?int $value = null, ?int $delay = 0): array
    {
        return array_values(array_filter(
            $this->all(),
            static fn (array $entry): bool => $entry['enabled']
                && $entry['trigger'] === $trigger
                && (! in_array($trigger, self::WITH_VALUE, true) || $entry['value'] === $value)
                && ($delay === null || $entry['delay'] === $delay)
        ));
    }

    public static function type(array $entry): string
    {
        return 'custom_'.$entry['id'];
    }

    /**
     * O JSON do admin, limpo: o que não for uma mensagem válida sai, e os
     * campos ganham os tipos e limites certos. Uma mensagem nova ganha o id e
     * a data de criação aqui.
     */
    public static function normalize(mixed $json): string
    {
        $entries = self::parse(is_string($json) ? $json : '[]', true);

        return (string) json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** @return list<Entry> */
    public static function parse(string $json, bool $fill = false): array
    {
        $decoded = json_decode($json, true);

        if (! is_array($decoded)) {
            return [];
        }

        $entries = [];
        $ids = [];

        foreach ($decoded as $item) {
            if (! is_array($item) || count($entries) >= self::MAX) {
                continue;
            }

            $trigger = (string) ($item['trigger'] ?? '');

            if (! in_array($trigger, self::TRIGGERS, true)) {
                continue;
            }

            $id = preg_replace('/[^a-z0-9]/', '', strtolower((string) ($item['id'] ?? ''))) ?: '';
            $id = substr($id, 0, 16);

            if ($id === '' || isset($ids[$id])) {
                if (! $fill) {
                    continue;
                }

                $id = Str::lower(Str::random(10));
            }

            $ids[$id] = true;
            $value = isset($item['value']) && is_numeric($item['value']) && (int) $item['value'] > 0 ? (int) $item['value'] : null;

            if ($trigger === 'anniversary' && $value !== null) {
                $value = min($value, self::MAX_YEARS);
            }
            $createdAt = (string) ($item['createdAt'] ?? '');

            if ($createdAt === '' || strtotime($createdAt) === false) {
                if (! $fill) {
                    continue;
                }

                $createdAt = Carbon::now()->toIso8601String();
            }

            $entries[] = [
                'id' => $id,
                'title' => Str::limit(trim((string) ($item['title'] ?? '')), 100, ''),
                'enabled' => (bool) ($item['enabled'] ?? false),
                'trigger' => $trigger,
                'value' => in_array($trigger, self::WITH_VALUE, true) ? $value : null,
                'delay' => $trigger === 'activated' ? max(0, min(self::MAX_DELAY_DAYS, (int) ($item['delay'] ?? 0))) : 0,
                'subject' => Str::limit(trim((string) ($item['subject'] ?? '')), 200, ''),
                'body' => Str::limit(trim((string) ($item['body'] ?? '')), 20000, ''),
                'createdAt' => $createdAt,
            ];
        }

        return $entries;
    }
}
