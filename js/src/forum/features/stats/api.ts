/*
 * As duas rotas próprias das estatísticas, por `fetch` e não por `app.request`.
 *
 * O `app.request` fecha o alerta de erro que estiver na tela a cada chamada;
 * estas rodam sozinhas, em segundo plano, e não podem sumir com um aviso que a
 * pessoa ainda está lendo. O `fetch` também aceita `keepalive`, o que deixa o
 * último envio de tempo de leitura sair mesmo quando a aba está fechando.
 */
import app from 'flarum/forum/app';

import { takePreloaded } from '../../utils/preload';

function apiUrl(path: string): string {
  const base = (app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '');

  return `${base}/${path}`;
}

export interface TopicCountsResponse {
  new: number;
  unread: number;
  limit: number;
}

/** Sem `tag`, conta o fórum todo; com ela, só a tag e as filhas. */
export async function fetchTopicCounts(tag?: string): Promise<TopicCountsResponse | null> {
  // Na primeira carga de uma tag, a contagem já veio no HTML.
  const preloaded = takePreloaded<TopicCountsResponse>('canela-counts', tag ? { tag } : {});
  if (preloaded) return preloaded;

  try {
    const response = await fetch(apiUrl('canela-counts' + (tag ? `?tag=${encodeURIComponent(tag)}` : '')), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    return response.ok ? ((await response.json()) as TopicCountsResponse) : null;
  } catch {
    return null;
  }
}

export interface ReadTimePayload {
  discussionId: string;
  seconds: number;
  postIds: string[];
}

export function sendReadTime(payload: ReadTimePayload): void {
  fetch(apiUrl('canela-read-time'), {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': app.session.csrfToken || '',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Sem rede, o tempo desse intervalo se perde — nada que mereça um aviso.
  });
}
