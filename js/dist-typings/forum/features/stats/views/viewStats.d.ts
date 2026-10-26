import type Discussion from 'flarum/common/models/Discussion';
export interface ViewStat {
    /** AAAA-MM-DD, em UTC (o dia do servidor). */
    viewed_at: string;
    views: number;
}
export interface ViewStatsResponse {
    topic_id: number;
    stats: ViewStat[];
    /** Sem nenhum dia gravado: o único dia é o total do tópico posto em hoje. */
    estimated?: boolean;
}
/** A janela do gráfico, em dias. */
export declare const VIEW_STATS_DAYS = 30;
export declare function cachedViewStats(discussion: Discussion): ViewStatsResponse | undefined;
/**
 * Sem nenhum dia gravado (o tópico é
 * de antes da contagem diária, ou a tabela ainda não existe), entra um dia só
 * — hoje — com o total do tópico.
 */
export declare function fetchViewStats(discussion: Discussion, totalViews: number): Promise<ViewStatsResponse>;
/**
 * A janela inteira do gráfico: os últimos 30 dias (ou desde a criação do
 * tópico, se ele for mais novo), com zero nos dias sem registro.
 *
 * A contagem por dia começa quando o recurso é ligado: um tópico
 * antigo, com milhares de visualizações, chegava com dois ou três dias e
 * mostrava só os números (ou um gráfico de três pontos), em vez do gráfico do
 * mês.
 */
export declare function fullWindow(stats: ViewStat[], createdAt: Date | null | undefined): ViewStat[];
