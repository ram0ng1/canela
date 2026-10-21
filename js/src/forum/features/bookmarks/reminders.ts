/*
 * Os atalhos de horário do lembrete.
 *
 * As horas: o fim da tarde (18h) para "mais tarde
 * hoje" e o começo da manhã (8h) para os outros, sempre no fuso do navegador
 * — o servidor recebe o instante em UTC e não precisa saber o fuso de ninguém.
 */
import { formatWith } from '../../utils/dates';

export type ReminderPreset = 'later_today' | 'tomorrow' | 'next_week' | 'next_month' | 'custom' | 'none';

const MORNING_HOUR = 8;
const EVENING_HOUR = 18;

/** Depois disso, "mais tarde hoje" ficaria a menos de uma hora: o atalho some. */
const LATER_TODAY_CUTOFF_HOUR = 17;

function at(date: Date, hour: number): Date {
  const result = new Date(date.getTime());
  result.setHours(hour, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);

  return result;
}

/** O horário de cada atalho, ou `null` quando ele não vale agora. */
export function presetDate(preset: ReminderPreset, now = new Date()): Date | null {
  switch (preset) {
    case 'later_today':
      return now.getHours() < LATER_TODAY_CUTOFF_HOUR ? at(now, EVENING_HOUR) : null;
    case 'tomorrow':
      return at(addDays(now, 1), MORNING_HOUR);
    case 'next_week': {
      // A próxima segunda-feira (nunca hoje): o "início da semana".
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;

      return at(addDays(now, daysUntilMonday), MORNING_HOUR);
    }
    case 'next_month':
      return at(new Date(now.getFullYear(), now.getMonth() + 1, 1), MORNING_HOUR);
    default:
      return null;
  }
}

/** Os atalhos que fazem sentido agora, na ordem. */
export function availablePresets(now = new Date()): ReminderPreset[] {
  const presets: ReminderPreset[] = ['later_today', 'tomorrow', 'next_week', 'next_month'];

  return presets.filter((preset) => presetDate(preset, now) !== null);
}

/** "sáb, 08:00" — o que aparece ao lado do nome de cada atalho. */
export function presetHint(date: Date, now = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) return formatWith(date, { hour: '2-digit', minute: '2-digit' });

  const withinWeek = date.getTime() - now.getTime() < 6 * 24 * 60 * 60 * 1000;

  return formatWith(
    date,
    withinWeek ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  );
}

/** Data longa do lembrete: "sábado, 18 de outubro, 08:00". */
export function reminderLabel(date: Date): string {
  return formatWith(date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** `YYYY-MM-DD` e `HH:MM` no fuso local, para os campos `date` e `time`. */
export function toLocalInputs(date: Date): { date: string; time: string } {
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** O inverso: os campos do horário personalizado viram um instante (ou `null` se incompletos). */
export function fromLocalInputs(dateValue: string, timeValue: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!dateMatch) return null;

  const [hours, minutes] = /^(\d{2}):(\d{2})/.test(timeValue) ? timeValue.split(':').map(Number) : [MORNING_HOUR, 0];
  const result = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes, 0, 0);

  return Number.isNaN(result.getTime()) ? null : result;
}
