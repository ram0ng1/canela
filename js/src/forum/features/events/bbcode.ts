/*
 * O `[event …]descrição[/event]` no texto do composer: montar a partir do
 * formulário do "Criar evento" e ler de volta para editar. As datas vão como
 * "AAAA-MM-DD HH:mm" no fuso escolhido (o servidor converte para UTC).
 */
export interface EventForm {
  name: string;
  /** "2026-10-30 10:00" no fuso `timezone`. */
  start: string;
  end: string;
  timezone: string;
  status: 'public' | 'standalone';
  recurrence: string;
  until: string;
  url: string;
  location: string;
  max: string;
  chat: boolean;
  description: string;
}

const EVENT_BLOCK = /\[event\b((?:[^\]"]|"(?:[^"\\]|\\.)*")*)\]([\s\S]*?)\[\/event\]/i;
const ATTRIBUTE = /([a-z]+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/gi;

/** O fuso do navegador, o padrão do formulário. */
export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function emptyForm(): EventForm {
  return {
    name: '',
    start: '',
    end: '',
    timezone: browserZone(),
    status: 'public',
    recurrence: '',
    until: '',
    url: '',
    location: '',
    max: '',
    chat: false,
    description: '',
  };
}

function quote(value: string): string {
  return `"${value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;
}

export function buildEvent(form: EventForm): string {
  const parts: string[] = [];
  const add = (name: string, value: string | null | undefined) => {
    const clean = (value || '').trim();

    if (clean) parts.push(`${name}=${quote(clean)}`);
  };

  add('name', form.name);
  add('start', form.start);
  add('end', form.end);
  add('timezone', form.timezone);
  if (form.status !== 'public') add('status', form.status);
  add('recurrence', form.recurrence);
  if (form.recurrence) add('until', form.until);
  add('url', form.url);
  add('location', form.location);
  if (/^\d+$/.test(form.max.trim()) && Number(form.max) > 0) add('max', String(Number(form.max)));
  if (form.chat) add('chat', 'true');

  const description = form.description.trim();

  return `[event ${parts.join(' ')}]\n${description ? `${description}\n` : ''}[/event]`;
}

/** O primeiro [event] do texto, com a posição dele, ou null. */
export function findEvent(text: string): { start: number; end: number; form: EventForm } | null {
  const match = EVENT_BLOCK.exec(text);

  if (!match) return null;

  const form = emptyForm();
  const values: Record<string, string> = {};

  for (const attr of match[1].matchAll(ATTRIBUTE)) {
    values[attr[1].toLowerCase()] = attr[2] !== undefined ? attr[2].replace(/\\(.)/g, '$1') : attr[3];
  }

  form.name = values.name || '';
  form.start = values.start || '';
  form.end = values.end || '';
  form.timezone = values.timezone || form.timezone;
  form.status = values.status === 'standalone' ? 'standalone' : 'public';
  form.recurrence = values.recurrence || '';
  form.until = values.until || '';
  form.url = values.url || '';
  form.location = values.location || '';
  form.max = values.max || '';
  form.chat = values.chat === 'true';
  form.description = match[2].trim();

  return { start: match.index, end: match.index + match[0].length, form };
}
