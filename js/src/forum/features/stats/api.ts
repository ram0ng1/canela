/*
 * As duas rotas próprias das estatísticas: a renovação das contagens, um
 * endpoint do recurso do fórum (`GET /api/forums/canela-counts`), e o tempo de
 * leitura (`POST /api/canela-read-time`).
 *
 * A contagem vai pelo `app.request` (sem alerta: sem ela a lista só fica sem
 * os números). Ela roda ao abrir a lista, junto com o pedido da própria
 * lista, então fechar um alerta de erro antigo não muda nada. O tempo de
 * leitura continua no `fetch`: só ele aceita `keepalive`, o que deixa o
 * último envio sair mesmo quando a aba está fechando.
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
  const params = tag ? { filter: { tag } } : {};
  const preloaded = takePreloaded<TopicCountsResponse>('forums/canela-counts', params);
  if (preloaded) return preloaded;

  try {
    return await app.request<TopicCountsResponse>({
      method: 'GET',
      url: apiUrl('forums/canela-counts'),
      params,
      errorHandler: () => {},
    });
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
