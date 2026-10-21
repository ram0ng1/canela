/*
 * Leitura das estatísticas de atividade do usuário para o resumo do perfil.
 *
 * O servidor só manda esses atributos na resposta do perfil (Show do usuário)
 * e com o recurso ligado; fora disso eles faltam, e cada função devolve null
 * para a estatística simplesmente não aparecer. As curtidas também vêm null
 * quando o flarum-likes está desligado.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

export interface UserActivity {
  /** Dias distintos com ao menos uma visita. */
  daysVisited: number | null;
  /** Tempo de leitura, em segundos. */
  timeRead: number | null;
  /** Tempo de leitura dos últimos 60 dias, em segundos (o "recente"). */
  recentTimeRead: number | null;
  postsRead: number | null;
  /** Tópicos distintos que a pessoa abriu. */
  topicsViewed: number | null;
  likesGiven: number | null;
  likesReceived: number | null;
}

/** Os nomes dos atributos na API — documentados aqui para o perfil e outras áreas. */
export const ACTIVITY_ATTRIBUTES: Record<keyof UserActivity, string> = {
  daysVisited: 'canelaDaysVisited',
  timeRead: 'canelaTimeRead',
  recentTimeRead: 'canelaRecentTimeRead',
  postsRead: 'canelaPostsRead',
  topicsViewed: 'canelaTopicsViewed',
  likesGiven: 'canelaLikesGiven',
  likesReceived: 'canelaLikesReceived',
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/** null quando o perfil ainda não chegou com as estatísticas (ou o recurso está desligado). */
export function userActivity(user: User): UserActivity | null {
  if (user.attribute<unknown>('canelaDaysVisited') === undefined) return null;

  const activity = {} as UserActivity;

  (Object.keys(ACTIVITY_ATTRIBUTES) as (keyof UserActivity)[]).forEach((key) => {
    activity[key] = numberOrNull(user.attribute<unknown>(ACTIVITY_ATTRIBUTES[key]));
  });

  return activity;
}

/**
 * O tempo de leitura por extenso curto: "45 s", "12 min", "3 h", "2 d".
 * Uma unidade só, arredondada — o resumo é para ter ideia, não para auditoria.
 */
export function formatReadTime(seconds: number): string {
  const trans = (key: string, count: number) => app.translator.trans(`ramon-canela.forum.stats.duration.${key}`, { count }, true) as string;

  if (seconds < 60) return trans('seconds', Math.max(0, Math.round(seconds)));
  if (seconds < 3600) return trans('minutes', Math.round(seconds / 60));
  if (seconds < 86400) return trans('hours', Math.round((seconds / 3600) * 10) / 10);

  return trans('days', Math.round((seconds / 86400) * 10) / 10);
}
