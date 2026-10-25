/*
 * "Criar evento" (e "Editar evento"), o construtor do composer: nome, início e fim, fuso, recorrência, endereço da
 * transmissão ou do local, limite de vagas, o chat do evento e a descrição.
 * Salvar põe o `[event]` no texto (ou troca o que já existe); nada vai ao
 * servidor antes de publicar o post.
 */
import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import type Mithril from 'mithril';

import { buildEvent, browserZone, emptyForm, findEvent, type EventForm } from './bbcode';
import { eventsSettings } from './model';
import { t } from '../../utils/settings';

export interface EventBuilderModalAttrs extends IFormModalAttrs {}

const RECURRENCES = ['', 'every_day', 'every_weekday', 'every_week', 'every_two_weeks', 'every_four_weeks', 'every_month'];

function zones(): string[] {
  try {
    const list = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;

    if (list?.length) return list;
  } catch {
    // Navegador antigo: só o fuso dele e o UTC.
  }

  return [browserZone(), 'UTC'];
}

function split(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split(/[ T]/);

  return { date, time };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A próxima hora cheia, para o início sugerido. */
function nextHour(): { date: string; time: string } {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:00` };
}

export default class EventBuilderModal extends FormModal<EventBuilderModalAttrs> {
  private form!: EventForm;
  private editing = false;
  private startDate = '';
  private startTime = '';
  private endDate = '';
  private endTime = '';
  private error = '';

  oninit(vnode: Mithril.Vnode<EventBuilderModalAttrs, this>) {
    super.oninit(vnode);

    const found = findEvent(app.composer.fields?.content() || '');

    this.editing = !!found;
    this.form = found ? found.form : emptyForm();

    const start = found ? split(this.form.start) : nextHour();
    const end = split(this.form.end);

    this.startDate = start.date;
    this.startTime = start.time;
    this.endDate = end.date;
    this.endTime = end.time;

    if (!found) {
      // O nome sugerido é o título da discussão que está sendo criada.
      const title = app.composer.fields?.title?.();
      this.form.name = typeof title === 'string' ? title : '';
    }
  }

  className() {
    return 'CanelaEventBuilder Modal--large';
  }

  title() {
    return this.editing ? t('events.builder.edit_title') : t('events.builder.create_title');
  }

  private input(label: string, value: string, set: (value: string) => void, attrs: Record<string, unknown> = {}): Mithril.Children {
    return (
      <div className="Form-group">
        <label>{label}</label>
        <input className="FormControl" value={value} oninput={(e: InputEvent) => set((e.target as HTMLInputElement).value)} {...attrs} />
      </div>
    );
  }

  content() {
    const form = this.form;

    // Horizontal: à esquerda o "quando"
    // (datas, fuso, repetição), à direita o "onde e como" (tipo, endereço,
    // local, vagas, chat); o nome, a descrição e os botões na largura toda.
    return (
      <div className="Modal-body">
        <div className="Form CanelaEventBuilder-form">
          <div className="CanelaEventBuilder-full">
            {this.input(t('events.builder.name'), form.name, (v) => (form.name = v), {
              maxlength: 200,
              placeholder: t('events.builder.name_placeholder'),
            })}
          </div>

          <div className="CanelaEventBuilder-col">
            <div className="CanelaEventBuilder-row">
              {this.input(t('events.builder.start'), this.startDate, (v) => (this.startDate = v), { type: 'date', required: true })}
              {this.input(t('events.builder.time'), this.startTime, (v) => (this.startTime = v), { type: 'time' })}
            </div>
            <div className="CanelaEventBuilder-row">
              {this.input(t('events.builder.end'), this.endDate, (v) => (this.endDate = v), { type: 'date' })}
              {this.input(t('events.builder.time'), this.endTime, (v) => (this.endTime = v), { type: 'time' })}
            </div>

            <div className="Form-group">
              <label>{t('events.builder.timezone')}</label>
              <select className="FormControl" value={form.timezone} onchange={(e: Event) => (form.timezone = (e.target as HTMLSelectElement).value)}>
                {zones().map((zone) => (
                  <option value={zone}>{zone.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="CanelaEventBuilder-row">
              <div className="Form-group">
                <label>{t('events.builder.recurrence')}</label>
                <select
                  className="FormControl"
                  value={form.recurrence}
                  onchange={(e: Event) => (form.recurrence = (e.target as HTMLSelectElement).value)}
                >
                  {RECURRENCES.map((rule) => (
                    <option value={rule}>{t(`events.builder.recurrence_${rule || 'none'}`)}</option>
                  ))}
                </select>
              </div>
              {form.recurrence && this.input(t('events.builder.until'), form.until, (v) => (form.until = v), { type: 'date' })}
            </div>
          </div>

          <div className="CanelaEventBuilder-col">
            <div className="Form-group">
              <label>{t('events.builder.status')}</label>
              <select
                className="FormControl"
                value={form.status}
                onchange={(e: Event) => (form.status = (e.target as HTMLSelectElement).value as EventForm['status'])}
              >
                <option value="public">{t('events.builder.status_public')}</option>
                <option value="standalone">{t('events.builder.status_standalone')}</option>
              </select>
              <p className="helpText">{t(`events.builder.status_${form.status}_help`)}</p>
            </div>

            {this.input(t('events.builder.url'), form.url, (v) => (form.url = v), { type: 'url', placeholder: 'https://', maxlength: 1000 })}

            <div className="CanelaEventBuilder-row CanelaEventBuilder-row--even">
              {this.input(t('events.builder.location'), form.location, (v) => (form.location = v), { maxlength: 255 })}
              {form.status === 'public' &&
                this.input(t('events.builder.max'), form.max, (v) => (form.max = v.replace(/\D/g, '')), {
                  inputmode: 'numeric',
                  placeholder: t('events.builder.max_placeholder'),
                })}
            </div>

            {eventsSettings.chat() && (
              <div className="Form-group">
                <Switch state={form.chat} onchange={(value: boolean) => (form.chat = value)}>
                  {t('events.builder.chat')}
                </Switch>
                <p className="helpText">{t('events.builder.chat_help')}</p>
              </div>
            )}
          </div>

          <div className="CanelaEventBuilder-full">
            <div className="Form-group">
              <label>{t('events.builder.description')}</label>
              <textarea
                className="FormControl"
                rows={3}
                value={form.description}
                oninput={(e: InputEvent) => (form.description = (e.target as HTMLTextAreaElement).value)}
              />
            </div>

            {this.error && <p className="CanelaEventBuilder-error">{this.error}</p>}
          </div>

          <div className="CanelaEventBuilder-full CanelaEventBuilder-buttons">
            <Button className="Button Button--primary" type="submit">
              {this.editing ? t('events.builder.save') : t('events.builder.create')}
            </Button>
            {this.editing && (
              <Button className="Button Button--danger" onclick={() => this.remove()}>
                {t('events.builder.remove')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  onsubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.startDate)) {
      this.error = t('events.builder.error_start');
      return;
    }

    const start = `${this.startDate} ${this.startTime || '00:00'}`;
    const end = this.endDate ? `${this.endDate} ${this.endTime || this.startTime || '00:00'}` : '';

    if (end && end <= start) {
      this.error = t('events.builder.error_end');
      return;
    }

    this.form.start = start;
    this.form.end = end;
    this.write(buildEvent(this.form));
    this.hide();
  }

  private remove(): void {
    this.write('');
    this.hide();
  }

  /**
   * Troca o [event] que já existe, ou põe o novo no começo do texto. Pelo
   * editor (e não direto no campo): ele avisa o composer da mudança.
   */
  private write(code: string): void {
    const editor = app.composer.editor;
    const text = app.composer.fields?.content() || '';

    if (!editor) return;

    const found = findEvent(text);

    if (found) {
      // Removendo, as quebras de linha logo depois do bloco vão junto.
      const end = code ? found.end : found.end + (/^\s*/.exec(text.slice(found.end))?.[0].length || 0);

      editor.insertBetween(found.start, end, code, false);
      return;
    }

    if (code) editor.insertAt(0, text.trim() ? `${code}\n\n` : `${code}\n`, false);
  }
}
