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

namespace Ramon\Canela\Ai\Console;

use Flarum\Discussion\Discussion;
use Flarum\User\Guest;
use Illuminate\Console\Command;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Summaries\TopicSummarizer;
use Ramon\Canela\Support\NullOrder;
use Throwable;

/**
 * Gera os resumos curtos (gists) dos tópicos mais ativos
 * (`php flarum canela:ai-gists`).
 *
 * Roda de hora em hora pelo agendador. Cada rodada pega os tópicos públicos
 * com atividade mais recente cujo resumo curto falta ou ficou para trás (houve
 * resposta depois dele) — no máximo `--limit` por vez, para o custo de uma
 * rodada ser previsível.
 */
final class GenerateGistsCommand extends Command
{
    /** @var string */
    protected $signature = 'canela:ai-gists {--limit=20 : Quantas discussões por rodada}';

    /** @var string */
    protected $description = 'Gera os resumos curtos de IA das discussões mais ativas.';

    public function handle(AiSettings $settings, TopicSummarizer $summarizer): int
    {
        if (! $settings->feature(AiSettings::GISTS)) {
            $this->info('Resumos curtos de IA desligados (ou IA sem provedor); nada a fazer.');

            return self::SUCCESS;
        }

        $limit = max(1, min(200, (int) $this->option('limit')));
        $done = 0;

        $discussions = Discussion::query()
            ->whereVisibleTo(new Guest())
            // O mesmo "Mínimo de postagens para resumir" do botão: abaixo
            // dele, a discussão não ganha resumo nenhum.
            ->where('discussions.comment_count', '>=', $settings->int(AiSettings::SUMMARY_MIN_POSTS, 1, 1000))
            // Sem resumo curto, ou com um anterior à última resposta. Um
            // NOT EXISTS, e não um JOIN: os escopos de visibilidade das
            // extensões usam colunas sem o nome da tabela.
            ->whereNotExists(static function ($query): void {
                $query->selectRaw('1')
                    ->from('canela_ai_summaries')
                    ->whereColumn('canela_ai_summaries.discussion_id', 'discussions.id')
                    ->whereColumn('canela_ai_summaries.gist_post_number', '>=', 'discussions.last_post_number');
            })
            ->tap(static fn ($query) => NullOrder::orderBy($query, 'discussions.last_posted_at', 'desc'))
            ->limit($limit)
            ->get();

        foreach ($discussions as $discussion) {
            try {
                if ($summarizer->gist($discussion) !== null) {
                    $done++;
                }
            } catch (Throwable $error) {
                $this->warn(sprintf('Discussão %d: %s', $discussion->id, $error->getMessage()));
            }
        }

        $this->info(sprintf('%d resumo(s) curto(s) gerado(s).', $done));

        return self::SUCCESS;
    }
}
