/*
 * Números da linha da lista: visualizações (quando alguma extensão as conta),
 * as faixas de "calor" das contagens e o "frio" da atividade, um mapa de
 * calor e um de frio.
 */
import type Discussion from 'flarum/common/models/Discussion';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';

import { viewsHeat as viewsHeatOf } from '../utils/views';

/**
 * O core não conta visualizações. Extensões que contam publicam o número no
 * modelo com nomes diferentes — `viewCount` é o mais comum, `views` aparece em
 * algumas. Sem nenhum dos dois, a coluna não tem o que mostrar.
 */
const VIEW_ATTRIBUTES = ['viewCount', 'views', 'view_count'];

export function discussionViews(discussion: Discussion): number | null {
  for (const name of VIEW_ATTRIBUTES) {
    const value = discussion.attribute<unknown>(name);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }

  return null;
}

/** A coluna inteira só aparece se ao menos uma discussão da lista trouxer o número. */
export function listHasViews(state: DiscussionListState): boolean {
  return state.getPages().some((page) => (page.items as Discussion[]).some((discussion) => discussionViews(discussion) !== null));
}

type Heat = 'low' | 'med' | 'high' | null;

function band(value: number, low: number, med: number, high: number): Heat {
  if (value >= high) return 'high';
  if (value >= med) return 'med';
  if (value >= low) return 'low';

  return null;
}

/**
 * Faixas das respostas. Medir o calor pela razão curtidas/posts pediria
 * dados que o Flarum não tem sem extensão; o volume de respostas é o sinal mais
 * próximo de "conversa animada" que todo fórum tem.
 */
export function repliesHeat(count: number): Heat {
  return band(count, 10, 25, 50);
}

/**
 * As faixas das visualizações vêm do admin (topic_views_heat_low/medium/high,
 * 1000/2000/3500 por padrão) — a regra mora em utils/views, que as
 * mensagens privadas também usam.
 */
export function viewsHeat(count: number): Heat {
  return viewsHeatOf(count);
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * O mapa de frio: quanto mais tempo entre a criação e a última
 * resposta, mais "frio" o tópico — uma conversa antiga ressuscitada aparece
 * em tom diferente de uma que acabou de começar.
 */
export function activityCold(discussion: Discussion): Heat {
  const created = discussion.createdAt()?.getTime();
  const last = discussion.lastPostedAt()?.getTime();

  if (!created || !last) return null;

  return band((last - created) / DAY, 14, 30, 60);
}
