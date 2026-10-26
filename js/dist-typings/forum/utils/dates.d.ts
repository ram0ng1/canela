export declare function formatWith(date: Date, options: Intl.DateTimeFormatOptions): string;
export declare function shortAge(date: Date | null | undefined, now?: Date): string;
/**
 * A data "média" com "atrás":
 * "5 minutos atrás", "2 horas atrás", "5 dias atrás" e, a partir de 6 dias, a
 * data ("11 out"). É a dos itens de atividade do perfil.
 */
export declare function mediumAge(date: Date | null | undefined, now?: Date): string;
/** Data completa para o title dos tempos curtos: "17 de outubro de 2026 14:05". */
export declare function fullDate(date: Date | null | undefined): string;
/** "8 jun" ou "8 jun 2024" — a data do mapa do tópico e da linha do tempo. */
export declare function shortDate(date: Date | null | undefined, now?: Date): string;
/** Intervalo `YYYY-MM-DD..YYYY-MM-DD` dos últimos dias, no formato do filtro `created` do core. */
export declare function lastDaysRange(days: number, now?: Date): string;
