/*
 * Datas no formato curto do Discourse: "agora", "5 min", "4 h", "3 d", "8 jun",
 * "set 2025". Usa Intl com o idioma ativo do fórum em vez do dayjs: o core só
 * carrega os plugins de que ele mesmo precisa, e o formato abreviado não está
 * entre eles.
 */
import app from 'flarum/forum/app';
import { dateFormat } from './intl';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Até quantos dias a idade aparece em dias, antes de virar data. */
const DAYS_BEFORE_DATE = 30;

function activeLocale(): string {
  return (app.data as any).locale || document.documentElement.lang || 'en';
}

export function formatWith(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return dateFormat(activeLocale(), options).format(date);
  } catch {
    // Código de idioma que o navegador não conhece: o formato do sistema serve.
    return date.toLocaleDateString(undefined, options);
  }
}

/** O Intl põe ponto e "de" no mês abreviado do pt-BR ("8 de jun."); o Discourse não. */
function compact(text: string): string {
  return text
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .trim();
}

export function shortAge(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const diff = Math.max(0, now.getTime() - date.getTime());

  if (diff < MINUTE) return app.translator.trans('ramon-canela.forum.age.now', {}, true) as string;
  if (diff < HOUR) return app.translator.trans('ramon-canela.forum.age.minutes', { count: Math.floor(diff / MINUTE) }, true) as string;
  if (diff < DAY) return app.translator.trans('ramon-canela.forum.age.hours', { count: Math.floor(diff / HOUR) }, true) as string;
  if (diff < DAYS_BEFORE_DATE * DAY) return app.translator.trans('ramon-canela.forum.age.days', { count: Math.floor(diff / DAY) }, true) as string;

  if (date.getFullYear() === now.getFullYear()) return compact(formatWith(date, { day: 'numeric', month: 'short' }));

  return compact(formatWith(date, { month: 'short', year: 'numeric' }));
}

/**
 * A data "média" com "atrás" do Discourse (`relativeAgeMedium`, `leaveAgo`):
 * "5 minutos atrás", "2 horas atrás", "5 dias atrás" e, a partir de 6 dias, a
 * data ("11 out"). É a dos itens de atividade do perfil.
 */
export function mediumAge(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const diff = Math.max(0, now.getTime() - date.getTime());
  const tr = (key: string, count?: number) => app.translator.trans(`ramon-canela.forum.user.age_ago.${key}`, { count }, true) as string;

  if (diff < MINUTE) return tr('now');
  if (diff < HOUR) return tr('minutes', Math.floor(diff / MINUTE));
  if (diff < DAY) return tr('hours', Math.floor(diff / HOUR));
  if (diff < 6 * DAY) return tr('days', Math.floor(diff / DAY));

  return shortDate(date, now);
}

/** Data completa para o title dos tempos curtos: "17 de outubro de 2026 14:05". */
export function fullDate(date: Date | null | undefined): string {
  if (!date) return '';

  return formatWith(date, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "8 jun" ou "8 jun 2024" — a data do mapa do tópico e da linha do tempo. */
export function shortDate(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };

  return compact(formatWith(date, options));
}

/** Intervalo `YYYY-MM-DD..YYYY-MM-DD` dos últimos dias, no formato do filtro `created` do core. */
export function lastDaysRange(days: number, now = new Date()): string {
  const toIsoDay = (date: Date) =>
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

  // O fim é amanhã: o filtro compara com a meia-noite do último dia, e
  // terminar hoje deixaria de fora tudo o que foi criado hoje.
  const from = new Date(now.getTime() - days * DAY);
  const to = new Date(now.getTime() + DAY);

  return `${toIsoDay(from)}..${toIsoDay(to)}`;
}
