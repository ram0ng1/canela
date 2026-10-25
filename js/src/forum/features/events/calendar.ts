/*
 * "Adicionar à agenda": o link do Google Agenda e o arquivo .ics (Apple,
 * Outlook e o resto), montados aqui mesmo, sem pedido ao servidor. Com
 * recorrência, o .ics leva a regra (RRULE).
 */
import type { EventData } from './model';

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function rrule(event: EventData): string | null {
  const first = new Date(event.firstStartsAt);
  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const until = event.recurrenceUntil ? `;UNTIL=${event.recurrenceUntil.replace(/-/g, '')}T235959Z` : '';

  switch (event.recurrence) {
    case 'every_day':
      return `FREQ=DAILY${until}`;
    case 'every_weekday':
      return `FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR${until}`;
    case 'every_week':
      return `FREQ=WEEKLY;BYDAY=${days[first.getDay()]}${until}`;
    case 'every_two_weeks':
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${days[first.getDay()]}${until}`;
    case 'every_four_weeks':
      return `FREQ=WEEKLY;INTERVAL=4;BYDAY=${days[first.getDay()]}${until}`;
    case 'every_month':
      return `FREQ=MONTHLY;BYDAY=${Math.ceil(first.getDate() / 7)}${days[first.getDay()]}${until}`;
    default:
      return null;
  }
}

function endOf(event: EventData, start: Date): Date {
  return event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
}

export function googleCalendarUrl(event: EventData, title: string, link: string): string {
  const start = new Date(event.startsAt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${stamp(start)}/${stamp(endOf(event, start))}`,
    details: [event.description || '', link].filter(Boolean).join('\n\n'),
  });

  if (event.location || event.url) params.set('location', event.location || event.url || '');

  const rule = rrule(event);
  if (rule) params.set('recur', `RRULE:${rule}`);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Texto de um campo do .ics: vírgula, ponto e vírgula e quebras escapadas. */
function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function downloadIcs(event: EventData, title: string, link: string): void {
  const start = new Date(event.recurrence ? event.firstStartsAt : event.startsAt);
  const end = event.endsAt && !event.recurrence ? new Date(event.endsAt) : endOf(event, start);
  const rule = rrule(event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ramon/canela//events//PT',
    'BEGIN:VEVENT',
    `UID:canela-event-${event.id}@${window.location.host}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(event.recurrence && event.endsAt ? new Date(start.getTime() + (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime())) : end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText([event.description || '', link].filter(Boolean).join('\n\n'))}`,
    `URL:${link}`,
    ...(event.location || event.url ? [`LOCATION:${icsText(event.location || event.url || '')}`] : []),
    ...(rule ? [`RRULE:${rule}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'evento'}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
