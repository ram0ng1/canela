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

namespace Ramon\Canela\BugReports;

use Flarum\Foundation\ValidationException;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * As regras dos relatórios (limpeza do texto e do contexto, teto por hora,
 * capturas) e a apresentação para as instruções da IA. Criar, listar e
 * mudar ficam no BugReportResource, que usa estas regras.
 *
 * O contexto que vem do navegador é só dado: cada campo é conferido, cortado
 * e guardado com tamanho fixo, para um relatório nunca virar um depósito.
 */
final class BugReportService
{
    /** Relatórios por pessoa por hora (o admin não tem teto). */
    public const PER_HOUR = 10;

    public const MAX_DESCRIPTION = 4000;

    private const KEY = 'ramon-canela.api.bug_reports.';

    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportImages $images,
        private readonly Cache $cache,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /** A mensagem de erro de validação `$key` (ramon-canela.api.bug_reports.*), no idioma do fórum. */
    public function message(string $key): string
    {
        return $this->translator->trans(self::KEY.$key);
    }

    /** O erro de validação de um campo, com a mensagem das traduções. */
    public function fail(string $field, string $key): never
    {
        throw new ValidationException([$field => $this->message($key)]);
    }

    /**
     * Conta mais um relatório da pessoa nesta hora e diz se passou do teto
     * (PER_HOUR). O admin não tem teto: quem chama decide.
     */
    public function overLimit(int $userId): bool
    {
        $key = 'canela.bug_reports.rate.'.$userId.'.'.intdiv(time(), 3600);
        $this->cache->add($key, 0, 7200);

        return (int) $this->cache->increment($key) > self::PER_HOUR;
    }

    /**
     * Grava a captura (relida e regravada em WebP) e devolve o caminho, ou
     * null se os bytes não forem uma imagem válida.
     */
    public function storeImage(string $bytes): ?string
    {
        return $this->images->store($bytes);
    }

    /**
     * O contexto da página limpo, com os erros do console só se o admin os pede.
     *
     * @return array<string, mixed>
     */
    public function cleanContext(mixed $raw): array
    {
        return self::context(is_array($raw) ? $raw : [], $this->settings->bool(BugReportsSettings::CONSOLE, false));
    }

    /** A captura da tela inteira vai junto (opção do admin). */
    public function wantsFull(): bool
    {
        return $this->settings->bool(BugReportsSettings::FULL, true);
    }

    /** Texto de uma linha ou de várias, sem caracteres de controle e com teto. */
    public static function text(mixed $value, int $max): string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return '';
        }

        $text = preg_replace('/[^\P{C}\n\t]/u', '', (string) $value) ?? '';

        return mb_substr(trim($text), 0, $max);
    }

    /**
     * O contexto da página, só com os campos conhecidos e com teto em tudo.
     *
     * @param array<mixed> $raw
     * @return array<string, mixed>
     */
    public static function context(array $raw, bool $withConsole): array
    {
        $int = static fn (mixed $value, int $max = 100000): int => max(0, min($max, (int) (is_numeric($value) ? $value : 0)));

        $viewport = (array) ($raw['viewport'] ?? []);
        $region = is_array($raw['region'] ?? null) ? $raw['region'] : null;

        $elements = [];

        foreach (array_slice(array_values(array_filter((array) ($raw['elements'] ?? []), 'is_array')), 0, 8) as $element) {
            $elements[] = [
                'path' => self::text($element['path'] ?? '', 300),
                'component' => self::text($element['component'] ?? '', 120),
                'text' => self::text($element['text'] ?? '', 160),
            ];
        }

        $console = [];

        if ($withConsole) {
            foreach (array_slice(array_values(array_filter((array) ($raw['consoleErrors'] ?? []), 'is_array')), -30) as $entry) {
                $console[] = [
                    'at' => self::text($entry['at'] ?? '', 40),
                    'message' => self::text($entry['message'] ?? '', 500),
                ];
            }
        }

        $url = self::text($raw['url'] ?? '', 1000);

        return [
            'url' => preg_match('#^https?://#i', $url) ? $url : '',
            'title' => self::text($raw['title'] ?? '', 200),
            'viewport' => [
                'w' => $int($viewport['w'] ?? 0, 20000),
                'h' => $int($viewport['h'] ?? 0, 20000),
                'dpr' => round(max(0.1, min(10.0, (float) (is_numeric($viewport['dpr'] ?? null) ? $viewport['dpr'] : 1))), 2),
            ],
            'region' => $region ? [
                'x' => $int($region['x'] ?? 0, 20000),
                'y' => $int($region['y'] ?? 0, 20000),
                'w' => $int($region['w'] ?? 0, 20000),
                'h' => $int($region['h'] ?? 0, 20000),
            ] : null,
            'userAgent' => self::text($raw['userAgent'] ?? '', 400),
            'language' => self::text($raw['language'] ?? '', 20),
            'route' => self::text($raw['route'] ?? '', 120),
            'theme' => self::text($raw['theme'] ?? '', 20),
            'elements' => $elements,
            'consoleErrors' => $console,
        ];
    }

    /** @return array<string, mixed> */
    public function present(BugReport $report, bool $forAdmin): array
    {
        $data = [
            'id' => $report->id,
            'kind' => $report->kind,
            'status' => $report->status,
            'description' => $report->description,
            'currentText' => $report->current_text,
            'suggestedText' => $report->suggested_text,
            'url' => $report->url,
            'title' => $report->title,
            'note' => $report->admin_note,
            'hasFull' => $report->full_path !== null,
            'createdAt' => $report->created_at?->toIso8601String(),
            'updatedAt' => $report->updated_at?->toIso8601String(),
        ];

        if ($forAdmin) {
            $user = $report->user;

            $data['context'] = $report->context ?? [];
            $data['user'] = $user ? [
                'id' => $user->id,
                'username' => $user->username,
                'displayName' => $user->display_name,
                'avatarUrl' => $user->avatar_url,
            ] : null;
        }

        return $data;
    }
}
