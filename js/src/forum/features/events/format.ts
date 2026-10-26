/*
 * As datas dos eventos no fuso de quem lê: "qui, 22 out 10:00 → 11:00", o
 * bloco "OUT / 22", a data relativa da lista ("em 3 dias") e a recorrência
 * por extenso ("A cada duas semanas, quinta-feira").
 */
import app from 'flarum/forum/app';

import { formatWith } from '../../utils/dates';
import { t } from '../../utils/settings';

const DAY = 24 * 60 * 60 * 1000;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** O Intl põe ponto e "de" no mês abreviado do pt-BR; aqui eles saem. */
function compact(text: string): string {
  return text
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .trim();
}

export function timeOf(date: Date): string {
  return formatWith(date, { hour: '2-digit', minute: '2-digit' });
}

/** "qui, 22 out 10:00" (com o ano quando não é o corrente). */
export function dayAndTime(date: Date, now = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';

  return `${compact(formatWith(date, options))} ${timeOf(date)}`;
}

/** "qui, 22 out 10:00 → 11:00" ou, em dias diferentes, as duas datas inteiras. */
export function eventRange(start: Date, end: Date | null): string {
  if (!end) return dayAndTime(start);

  return `${dayAndTime(start)} → ${sameDay(start, end) ? timeOf(end) : dayAndTime(end)}`;
}

/** O fuso de quem lê, como nome de cidade ("São Paulo"). */
export function readerZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    return zone.split('/').pop()!.replace(/_/g, ' ');
  } catch {
    return '';
  }
}

export function monthShort(date: Date): string {
  return compact(formatWith(date, { month: 'short' })).toUpperCase();
}

/** "em 3 dias", "há 2 dias", "agora": a data do evento na lista e no cabeçalho. */
export function relativeEventDate(start: Date, end: Date | null, ended: boolean, now = new Date()): string {
  const finish = end || new Date(start.getTime() + 60 * 60 * 1000);

  if (!ended && start.getTime() <= now.getTime() && finish.getTime() > now.getTime()) return t('events.happening_now');

  const diff = start.getTime() - now.getTime();
  const locale = app.data.locale || document.documentElement.lang || 'en';
  const abs = Math.abs(diff);
  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (abs < 60 * 60 * 1000) {
    value = Math.round(diff / 60000);
    unit = 'minute';
  } else if (abs < DAY) {
    value = Math.round(diff / (60 * 60 * 1000));
    unit = 'hour';
  } else if (abs < 30 * DAY) {
    value = Math.round(diff / DAY);
    unit = 'day';
  } else if (abs < 365 * DAY) {
    value = Math.round(diff / (30 * DAY));
    unit = 'month';
  } else {
    value = Math.round(diff / (365 * DAY));
    unit = 'year';
  }

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
  } catch {
    return dayAndTime(start);
  }
}

function weekdayName(date: Date): string {
  return formatWith(date, { weekday: 'long' });
}

/** A recorrência por extenso, a partir da primeira ocorrência. */
export function recurrenceLabel(rule: string | null, first: Date): string {
  if (!rule) return '';

  const weekday = weekdayName(first);
  const position = Math.ceil(first.getDate() / 7);

  switch (rule) {
    case 'every_day':
      return t('events.recurrence.every_day');
    case 'every_weekday':
      return t('events.recurrence.every_weekday');
    case 'every_week':
      return t('events.recurrence.every_week', { weekday });
    case 'every_two_weeks':
      return t('events.recurrence.every_two_weeks', { weekday });
    case 'every_four_weeks':
      return t('events.recurrence.every_four_weeks', { weekday });
    case 'every_month':
      return t('events.recurrence.every_month', { weekday, position });
    default:
      return '';
  }
}
