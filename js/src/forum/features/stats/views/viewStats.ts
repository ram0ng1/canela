/*
 * As visualizações por dia do tópico (GET /api/discussions/{id}/canela-views),
 * guardadas por tópico enquanto a página está aberta — um cache em
 * memória: abrir e fechar o menu não refaz a requisição.
 */
import app from 'flarum/forum/app';
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
export const VIEW_STATS_DAYS = 30;

const cache = new Map<string, ViewStatsResponse>();

export function cachedViewStats(discussion: Discussion): ViewStatsResponse | undefined {
  return cache.get(String(discussion.id()));
}

/**
 * Sem nenhum dia gravado (o tópico é
 * de antes da contagem diária, ou a tabela ainda não existe), entra um dia só
 * — hoje — com o total do tópico.
 */
export function fetchViewStats(discussion: Discussion, totalViews: number): Promise<ViewStatsResponse> {
  const key = String(discussion.id());
  const cached = cache.get(key);

  if (cached) return Promise.resolve(cached);

  return app
    .request<ViewStatsResponse>({
      method: 'GET',
      url: `${app.forum.attribute('apiUrl')}/discussions/${key}/canela-views`,
      // `filter[days]`: a API do Flarum recusa um `?days=` solto.
      params: { filter: { days: VIEW_STATS_DAYS } },
    })
    .then((data) => {
      const stats = Array.isArray(data?.stats)
        ? data.stats.map((stat) => ({ viewed_at: String(stat.viewed_at), views: Number(stat.views) || 0 }))
        : [];

      const estimated = !stats.length;

      if (estimated) {
        stats.push({ viewed_at: new Date().toISOString().split('T')[0], views: totalViews });
      }

      const result = { topic_id: Number(data?.topic_id) || Number(key), stats, estimated };

      cache.set(key, result);

      return result;
    });
}

const ONE_DAY = 86400000;

function utcDay(time: number): number {
  const date = new Date(time);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * A janela inteira do gráfico: os últimos 30 dias (ou desde a criação do
 * tópico, se ele for mais novo), com zero nos dias sem registro.
 *
 * A contagem por dia começa quando o recurso é ligado: um tópico
 * antigo, com milhares de visualizações, chegava com dois ou três dias e
 * mostrava só os números (ou um gráfico de três pontos), em vez do gráfico do
 * mês.
 */
export function fullWindow(stats: ViewStat[], createdAt: Date | null | undefined): ViewStat[] {
  const today = utcDay(Date.now());
  // De 30 dias atrás até hoje, os dois inclusive: 31 dias no eixo.
  const windowStart = today - VIEW_STATS_DAYS * ONE_DAY;
  const created = createdAt ? utcDay(createdAt.getTime()) : windowStart;
  const start = Math.min(today, Math.max(windowStart, created));
  const byDay = new Map(stats.map((stat) => [stat.viewed_at, stat.views]));
  const days: ViewStat[] = [];

  for (let day = start; day <= today; day += ONE_DAY) {
    const key = new Date(day).toISOString().split('T')[0];

    days.push({ viewed_at: key, views: byDay.get(key) ?? 0 });
  }

  return days;
}
