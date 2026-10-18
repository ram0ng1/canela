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

namespace Ramon\Canela\Badges\Console;

use Carbon\Carbon;
use Flarum\Console\AbstractCommand;
use Flarum\User\User;
use Illuminate\Contracts\Container\Container;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\BadgeGranter;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Badges\TrustLevel\Promotion;
use Ramon\Canela\Badges\TrustLevel\TrustLevel;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * `php flarum canela:badges` — o trabalho diário dos jobs `Tl3Promotions` e
 * `BadgeGrant` do Discourse, agendado para uma vez por dia:
 *
 * 1. Revisa os níveis de confiança. Por padrão só de quem pode mudar: os
 *    vistos nos últimos dias (níveis 0 a 2) e todos os Regulares (que podem
 *    perder o nível). `--all` revisa todo mundo — a carga inicial.
 * 2. Roda a regra de todos os emblemas ligados. A primeira vez é completa e
 *    não notifica; depois, `--full` inclui os que leem o conteúdo das
 *    postagens (Primeiro emoji).
 */
final class BadgesCommand extends AbstractCommand
{
    /** Quem não aparece há mais que isto não leu nada que mude o nível. */
    private const ACTIVE_DAYS = 2;

    private BadgeGranter $granter;

    private Promotion $promotion;

    private BadgeSettings $settings;

    private Capabilities $capabilities;

    /**
     * Só o contêiner: o agendador do Flarum instancia cada comando agendado em
     * toda requisição (para ler o nome), e montar o BadgeGranter com as
     * dependências custava ~2 ms em cada página. As peças saem no `fire()`.
     */
    public function __construct(private readonly Container $container)
    {
        parent::__construct();
    }

    #[\Override]
    protected function configure(): void
    {
        $this
            ->setName('canela:badges')
            ->setDescription('Revisa os níveis de confiança e concede os emblemas do tema Canela.')
            ->addOption('all', null, InputOption::VALUE_NONE, 'Revisar o nível de todos os usuários, e não só dos ativos')
            ->addOption('full', null, InputOption::VALUE_NONE, 'Incluir os emblemas que leem o conteúdo de cada postagem')
            ->addOption('trust-levels-only', null, InputOption::VALUE_NONE, 'Só os níveis de confiança')
            ->addOption('badges-only', null, InputOption::VALUE_NONE, 'Só os emblemas');
    }

    #[\Override]
    protected function fire(): int
    {
        $this->granter = $this->container->make(BadgeGranter::class);
        $this->promotion = $this->container->make(Promotion::class);
        $this->settings = $this->container->make(BadgeSettings::class);
        $this->capabilities = $this->container->make(Capabilities::class);

        if (! $this->capabilities->installed()) {
            $this->error('As tabelas dos emblemas não existem: rode `php flarum migrate` primeiro.');

            return 1;
        }

        if (! $this->input->getOption('badges-only')) {
            $this->reviewTrustLevels((bool) $this->input->getOption('all') || ! $this->settings->backfilled());
        }

        if (! $this->input->getOption('trust-levels-only')) {
            $this->grantBadges((bool) $this->input->getOption('full'));
        }

        return 0;
    }

    private function reviewTrustLevels(bool $everyone): void
    {
        if (! $this->settings->trustLevelsEnabled()) {
            $this->info('Níveis de confiança desligados no admin.');

            return;
        }

        $changed = 0;
        $query = User::query()
            ->where('canela_trust_level_locked', false)
            ->where('canela_trust_level', '<', TrustLevel::LEADER)
            ->where('is_email_confirmed', true);

        if (! $everyone) {
            $since = Carbon::now()->subDays(self::ACTIVE_DAYS);

            $query->where(fn (Builder $active) => $active
                ->where('last_seen_at', '>=', $since)
                ->orWhere('canela_trust_level', TrustLevel::REGULAR));
        }

        // Na carga inicial os emblemas de nível vêm depois, na carga dos
        // emblemas, sem notificar: subir o fórum inteiro de nível de uma vez não
        // é uma conquista de cada um.
        $grantBadges = $this->settings->backfilled();

        // Por id, e não por página: a promoção muda as colunas do filtro, e a
        // paginação por offset pularia gente.
        $query->chunkById(200, function ($users) use (&$changed, $grantBadges) {
            foreach ($users as $user) {
                try {
                    if ($this->promotion->recalculate($user, $grantBadges)) {
                        $changed++;
                    }
                } catch (Throwable $error) {
                    $this->error("Usuário {$user->id}: {$error->getMessage()}");
                }
            }
        });

        $this->info("Níveis de confiança: $changed alterado(s).");
    }

    private function grantBadges(bool $full): void
    {
        if (! $this->settings->badgesEnabled()) {
            $this->info('Emblemas desligados no admin.');

            return;
        }

        $total = $this->granter->backfill($full, function (Badge $badge, int $count) {
            if ($count > 0) {
                $this->info("  {$badge->slug}: $count");
            }
        });

        $this->info("Emblemas: $total concedido(s).");
    }
}
