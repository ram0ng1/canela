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
use Ramon\Canela\Ai\Embeddings\RelatedTopics;
use Throwable;

/**
 * Gera os embeddings dos tópicos públicos (`php flarum canela:ai-embeddings`),
 * para os "Tópicos relacionados".
 *
 * De hora em hora pelo agendador, os mais recentes primeiro. Um tópico já em
 * dia (mesmo texto, mesmo modelo) não chama a API; `--all` percorre o fórum
 * inteiro, para a carga inicial ou depois de trocar de modelo.
 */
final class EmbedTopicsCommand extends Command
{
    /** @var string */
    protected $signature = 'canela:ai-embeddings {--limit=100 : Quantas discussões por rodada} {--all : Todas as discussões}';

    /** @var string */
    protected $description = 'Gera os embeddings das discussões para as discussões relacionadas.';

    public function handle(AiSettings $settings, RelatedTopics $related): int
    {
        if (! $settings->feature(AiSettings::RELATED)) {
            $this->info('Discussões relacionadas desligadas (ou sem API de embeddings); nada a fazer.');

            return self::SUCCESS;
        }

        $query = Discussion::query()->whereVisibleTo(new Guest())->orderByDesc('last_posted_at');

        if (! $this->option('all')) {
            $query->limit(max(1, min(5000, (int) $this->option('limit'))));
        }

        $done = 0;

        foreach ($query->cursor() as $discussion) {
            try {
                if ($related->embed($discussion)) {
                    $done++;
                }
            } catch (Throwable $error) {
                $this->warn(sprintf('Discussão %d: %s', $discussion->id, $error->getMessage()));
            }
        }

        $this->info(sprintf('%d embedding(s) gerado(s) ou atualizado(s).', $done));

        return self::SUCCESS;
    }
}
