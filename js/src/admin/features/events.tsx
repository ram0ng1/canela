/*
 * Cards dos eventos (extend/events.php) e da sintaxe a mais do conteúdo
 * (extend/cooked.php: notas de rodapé e sumário), no grupo "Tópico".
 *
 * Eventos: o liga/desliga no cabeçalho, a tag onde os eventos valem (quem pode
 * começar discussão nela pode criar evento), a data na lista, "Próximos
 * eventos", o chat do evento (ramon/chat) e o lembrete.
 */
import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import type Mithril from 'mithril';

import { allTags } from '../components/tags';

import { AdminNotice } from '../components/AdminCard';
import AdminNumber from '../components/AdminNumber';
import AdminToggle from '../components/AdminToggle';
import { getBool, getStr, saveSetting, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.events';
const COOKED = 'ramon-canela.admin.settings.cooked';

const toggle = (name: string, extra: Record<string, unknown> = {}) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} {...extra} />
);

const eventsOff = (): string | null => (getBool('canela.events_backend') ? null : trans(`${KEY}.backend_off`));

const cookedOff = (): string | null => (getBool('canela.cooked_backend') ? null : trans(`${COOKED}.backend_off`));

/** A tag dos eventos: uma só, ou nenhuma (qualquer discussão). */
class EventsTagSelect extends Component {
  view(): Mithril.Children {
    const value = getStr('canela.events_tag', '');

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${KEY}.events_tag_label`)}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={value}
            onchange={(event: Event) => {
              const next = (event.target as HTMLSelectElement).value;
              app.data.settings['canela.events_tag'] = next;
              m.redraw();
              saveSetting({ 'canela.events_tag': next });
            }}
          >
            <option value="">{trans(`${KEY}.events_tag_any`)}</option>
            {allTags().map((tag) => (
              <option value={tag.id()}>{tag.isChild() ? `— ${tag.name()}` : tag.name()}</option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        <p className="helpText">{trans(`${KEY}.events_tag_help`)}</p>
      </div>
    );
  }
}

/** As tags em que o sumário aparece sozinho, sem o [toc] no post. */
class TocTagsPicker extends Component {
  view(): Mithril.Children {
    const selected = new Set(
      getStr('canela.toc_auto_tags', '')
        .split(/[\s,|]+/)
        .filter(Boolean)
    );
    const save = () => {
      const value = [...selected].join(',');
      app.data.settings['canela.toc_auto_tags'] = value;
      m.redraw();
      saveSetting({ 'canela.toc_auto_tags': value });
    };

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${COOKED}.toc_auto_tags_label`)}</label>
        <div className="CanelaAdmin-chips">
          {allTags().map((tag) => {
            const id = String(tag.id());
            const on = selected.has(id);

            return (
              <label className={`CanelaAdmin-chip${on ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onchange={() => {
                    if (on) selected.delete(id);
                    else selected.add(id);
                    save();
                  }}
                />{' '}
                {tag.name()}
              </label>
            );
          })}
        </div>
        <p className="helpText">{trans(`${COOKED}.toc_auto_tags_help`)}</p>
      </div>
    );
  }
}

const cards: CardDef[] = [
  {
    id: 'events',
    group: 'topic',
    icon: 'far fa-calendar',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.events_enabled_help`),
    keywords: 'eventos events calendário calendar agenda rsvp presença vou interessado recorrência lembrete reminder transmissão livestream',
    master: 'canela.events_enabled',
    lockedBy: eventsOff,
    body: () => (
      <>
        <EventsTagSelect />
        {toggle('events_list_badge')}
        {toggle('events_upcoming')}
        {toggle('events_chat', { extension: 'ramon-chat' })}
        {toggle('events_docked_chat', { dependsOn: 'canela.events_chat', extension: 'ramon-chat' })}
        <AdminNumber
          settingKey="canela.events_reminder_minutes"
          label={trans(`${KEY}.events_reminder_minutes_label`)}
          help={trans(`${KEY}.events_reminder_minutes_help`)}
          min={0}
          max={10080}
          fallback={15}
          suffix={trans(`${KEY}.minutes`)}
        />
        <AdminNotice icon="far fa-clock">{trans(`${KEY}.reminders_notice`)}</AdminNotice>
      </>
    ),
  },
  {
    id: 'footnotes',
    group: 'topic',
    icon: 'fas fa-asterisk',
    title: () => trans(`${COOKED}.footnotes_title`),
    description: () => trans(`${COOKED}.footnotes_help`),
    keywords: 'notas de rodapé footnotes nota referência rodapé',
    master: 'canela.footnotes',
    lockedBy: cookedOff,
  },
  {
    id: 'toc',
    group: 'topic',
    icon: 'fas fa-list-ul',
    title: () => trans(`${COOKED}.toc_title`),
    description: () => trans(`${COOKED}.toc_help`),
    keywords: 'sumário toc índice table of contents conteúdo títulos headings linha do tempo timeline',
    master: 'canela.toc',
    lockedBy: cookedOff,
    body: () => (
      <>
        <AdminNumber
          settingKey="canela.toc_min_headings"
          label={trans(`${COOKED}.toc_min_headings_label`)}
          help={trans(`${COOKED}.toc_min_headings_help`)}
          min={1}
          max={50}
          fallback={3}
        />
        <TocTagsPicker />
      </>
    ),
  },
];

export default cards;
