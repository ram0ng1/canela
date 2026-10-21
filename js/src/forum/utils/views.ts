/*
 * As visualizações num lugar só para a lista de
 * tópicos, os tópicos sugeridos, o mapa do tópico e as mensagens privadas
 * mostrarem o mesmo número com as mesmas regras:
 *
 * - `formatViews` é o número curto: 999,
 *   1,2k, 120k, 1,0M — com o separador decimal do idioma;
 * - `viewsTitle` é o texto longo ("este tópico foi visto 1.234 vezes"), o
 *   title que a coluna "Visualizações" mostra ao passar o mouse;
 * - `viewsHeat` usa as três faixas do admin (topic_views_heat_low/medium/high,
 *   1000/2000/3500 por padrão) e devolve 'low' | 'med' | 'high', o sufixo
 *   das classes `heatmap-*`;
 * - `viewsNumber` monta o `<span class="number" title="…">`.
 */
import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import { forumInt, t } from './settings';
import { numberFormat } from './intl';

export type ViewsHeat = 'low' | 'med' | 'high' | null;

/** Os padrões, quando o fórum ainda não serializou as faixas. */
export const VIEWS_HEAT_DEFAULTS = { low: 1000, medium: 2000, high: 3500 };

/** A janela de uma visualização, em horas (8 por padrão): entra no texto do gráfico. */
export function viewDurationHours(): number {
  return forumInt('canelaStatsViewWindowHours', 8);
}

function locale(): string {
  try {
    return app.translator.getLocale() || 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

/** Casas fixas, com o separador do idioma. */
export function localNumber(value: number, precision = 0): string {
  try {
    return numberFormat(locale(), { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
  } catch {
    return value.toFixed(precision);
  }
}

/**
 * O número curto, passo a passo: arredonda, acima de 999.999 vira
 * milhões com uma casa ("1,0M" — a casa zero fica), acima de 99.999
 * milhares sem casa ("120k", truncado), acima de 999 milhares com uma casa
 * ("1,2k"). `maxDisplay` corta em "50+".
 */
export function formatViews(value: number | string | null | undefined, options: { maxDisplay?: number } = {}): string {
  let val = Math.round(parseFloat(String(value)));

  if (Number.isNaN(val)) val = 0;

  const appendPlus = typeof options.maxDisplay === 'number' && options.maxDisplay > 0 && val > 0 && val > options.maxDisplay;

  if (appendPlus) val = options.maxDisplay as number;

  let output: string;

  if (val > 999999) {
    output = t('stats.views.short_millions', { number: localNumber(val / 1000000, 1) });
  } else if (val > 99999) {
    output = t('stats.views.short_thousands', { number: localNumber(Math.floor(val / 1000), 0) });
  } else if (val > 999) {
    output = t('stats.views.short_thousands', { number: localNumber(val / 1000, 1) });
  } else {
    output = val.toString();
  }

  return appendPlus ? `${output}+` : output;
}

/** "este tópico foi visto 1.234 vezes" (`views_long`). */
export function viewsTitle(count: number): string {
  const rounded = Math.round(count) || 0;

  return t('stats.views.views_long', { count: rounded, number: localNumber(rounded) });
}

/** "visualização" / "visualizações" (`views_lowercase`), o rótulo do mapa do tópico. */
export function viewsLabel(count: number): string {
  return t('stats.views.views_lowercase', { count: Math.round(count) || 0 });
}

function heatThreshold(attribute: string, fallback: number): number {
  const value = forumInt(attribute, fallback);

  return value > 0 ? value : fallback;
}

/** O calor das visualizações, com as faixas do admin. */
export function viewsHeat(count: number): ViewsHeat {
  const low = heatThreshold('canelaTopicViewsHeatLow', VIEWS_HEAT_DEFAULTS.low);
  const medium = heatThreshold('canelaTopicViewsHeatMedium', VIEWS_HEAT_DEFAULTS.medium);
  const high = heatThreshold('canelaTopicViewsHeatHigh', VIEWS_HEAT_DEFAULTS.high);

  if (count >= high) return 'high';
  if (count >= medium) return 'med';
  if (count >= low) return 'low';

  return null;
}

/**
 * O `{{dNumber views numberKey="views_long"}}`: o número abreviado num
 * `<span class="number">`, com o title por extenso só quando ele diz algo a
 * mais que o número (sempre, com o `views_long`). `noTitle` é o do mapa do
 * tópico, que já escreve "visualizações" ao lado.
 */
export function viewsNumber(count: number, options: { noTitle?: boolean; className?: string } = {}): Mithril.Vnode {
  const text = formatViews(count);
  const title = options.noTitle ? undefined : viewsTitle(count);

  return m('span', { className: options.className ? `number ${options.className}` : 'number', title }, text);
}
