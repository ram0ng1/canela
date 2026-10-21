<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As configurações das estatísticas num lugar só, já convertidas.
 *
 * O core guarda tudo como string ("1", "0", "8"), e cada parte do recurso —
 * o gancho das visualizações, as contagens, o registro de leitura — precisa
 * da mesma leitura com os mesmos padrões; espalhar `(bool) $settings->get()`
 * por elas faria um padrão divergir do outro sem ninguém notar.
 */
final class StatsSettings
{
    public const VIEWS_ENABLED = 'canela.stats_views_enabled';

    public const VIEW_WINDOW_HOURS = 'canela.stats_view_window_hours';

    public const COUNTS_ENABLED = 'canela.stats_counts_enabled';

    public const NEW_DAYS = 'canela.stats_new_days';

    public const ACTIVITY_ENABLED = 'canela.stats_activity_enabled';

    public const VISITOR_SALT = 'canela.stats_visitor_salt';

    /** As faixas de calor da coluna Visualizações (topic_views_heat_low/medium/high). */
    public const HEAT_LOW = 'canela.topic_views_heat_low';

    public const HEAT_MEDIUM = 'canela.topic_views_heat_medium';

    public const HEAT_HIGH = 'canela.topic_views_heat_high';

    public const DEFAULT_HEAT_LOW = 1000;

    public const DEFAULT_HEAT_MEDIUM = 2000;

    public const DEFAULT_HEAT_HIGH = 3500;

    /** A mesma pessoa conta de novo depois de 8 horas. */
    public const DEFAULT_VIEW_WINDOW_HOURS = ViewRule::DEFAULT_DURATION_HOURS;

    /** "Novo" é o tópico criado nos últimos 2 dias que a pessoa não abriu. */
    public const DEFAULT_NEW_DAYS = 2;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function viewsEnabled(): bool
    {
        return $this->bool(self::VIEWS_ENABLED);
    }

    public function countsEnabled(): bool
    {
        return $this->bool(self::COUNTS_ENABLED);
    }

    public function activityEnabled(): bool
    {
        return $this->bool(self::ACTIVITY_ENABLED);
    }

    /** Entre 1 hora e 30 dias: zero contaria cada recarga da página como visualização nova. */
    public function viewWindowHours(): int
    {
        return $this->int(self::VIEW_WINDOW_HOURS, self::DEFAULT_VIEW_WINDOW_HOURS, 1, 720);
    }

    /** 0 = sem limite de idade: vale só a data do "marcar tudo como lido" ou do cadastro. */
    public function newDays(): int
    {
        return $this->int(self::NEW_DAYS, self::DEFAULT_NEW_DAYS, 0, 365);
    }

    public function visitorSalt(): string
    {
        return (string) $this->settings->get(self::VISITOR_SALT, '');
    }

    private function bool(string $key): bool
    {
        // O padrão (ligado) vem do ->default() do extend; aqui só se converte.
        return in_array($this->settings->get($key), [true, 1, '1', 'true'], true);
    }

    private function int(string $key, int $fallback, int $min, int $max): int
    {
        $value = $this->settings->get($key);

        if (! is_numeric($value)) {
            return $fallback;
        }

        return max($min, min($max, (int) $value));
    }
}
