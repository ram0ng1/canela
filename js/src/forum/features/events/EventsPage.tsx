/*
 * /events: todos os eventos. Duas vistas: a lista das próximas ocorrências, agrupada por mês, e o calendário
 * do mês (com as setas para os outros meses). Cada evento leva à discussão.
 */
import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { dayAndTime, monthShort, timeOf } from './format';
import { type UpcomingItem } from './model';
import { discussionHref, loadUpcoming } from './UpcomingEvents';
import { formatWith } from '../../utils/dates';
import { t } from '../../utils/settings';

type View = 'list' | 'calendar';

const VIEW_KEY = 'canela.eventsView';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default class EventsPage extends Page {
  private mode: View = 'list';
  private month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private items: UpcomingItem[] | null = null;
  private monthItems: UpcomingItem[] | null = null;

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    try {
      this.mode = localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
    } catch {
      // Sem armazenamento, a lista.
    }

    app.setTitle(t('events.page_title'));
    app.setTitleCount(0);

    loadUpcoming({ limit: 100 }).then((items) => {
      this.items = items;
      m.redraw();
    });

    this.loadMonth();
  }

  private setView(view: View): void {
    this.mode = view;

    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Vale até sair da página.
    }
  }

  private loadMonth(): void {
    const first = new Date(this.month.getFullYear(), this.month.getMonth(), 1);
    const last = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0);

    this.monthItems = null;
    loadUpcoming({ from: isoDay(first), to: isoDay(last), limit: 200 }).then((items) => {
      this.monthItems = items;
      m.redraw();
    });
  }

  private shiftMonth(delta: number): void {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
    this.loadMonth();
  }

  view(): Mithril.Children {
    return (
      <div className="CanelaEventsPage">
        <div className="container">
          <header className="CanelaEventsPage-header">
            <h1>{t('events.page_title')}</h1>
            <div className="CanelaEventsPage-views" role="tablist">
              {(['list', 'calendar'] as View[]).map((view) => (
                <Button
                  className={classList('Button', { 'Button--primary': this.mode === view })}
                  icon={view === 'list' ? 'fas fa-list' : 'far fa-calendar'}
                  aria-selected={this.mode === view ? 'true' : 'false'}
                  onclick={() => this.setView(view)}
                >
                  {t(`events.view_${view}`)}
                </Button>
              ))}
            </div>
          </header>
          {this.mode === 'list' ? this.list() : this.calendar()}
        </div>
      </div>
    );
  }

  private list(): Mithril.Children {
    if (!this.items) return <LoadingIndicator />;

    if (!this.items.length) return <p className="CanelaEventsPage-empty">{t('events.no_upcoming')}</p>;

    const groups = new Map<string, UpcomingItem[]>();

    for (const item of this.items) {
      const start = new Date(item.startsAt);
      const key = formatWith(start, { month: 'long', year: 'numeric' });

      groups.set(key, [...(groups.get(key) || []), item]);
    }

    return (
      <div className="CanelaEventsPage-list">
        {[...groups.entries()].map(([month, items]) => (
          <section className="CanelaEventsPage-month" key={month}>
            <h2>{month}</h2>
            <ul>
              {items.map((item) => {
                const start = new Date(item.startsAt);

                return (
                  <li key={`${item.id}-${item.startsAt}`}>
                    <Link href={discussionHref(item)} className="CanelaEventsPage-item">
                      <span className="CanelaUpcomingEvents-date" aria-hidden="true">
                        <span className="CanelaUpcomingEvents-month">{monthShort(start)}</span>
                        <span className="CanelaUpcomingEvents-day">{start.getDate()}</span>
                      </span>
                      <span className="CanelaEventsPage-info">
                        <span className="CanelaEventsPage-name">{item.name || item.discussion.title}</span>
                        <span className="CanelaEventsPage-when">
                          <Icon name="far fa-clock" /> {dayAndTime(start)}
                          {item.endsAt ? ` → ${timeOf(new Date(item.endsAt))}` : ''}
                          {item.recurrence && <Icon name="fas fa-arrows-rotate" className="CanelaEventsPage-recurring" />}
                        </span>
                      </span>
                      {item.going > 0 && (
                        <span className="CanelaEventsPage-going">
                          <Icon name="fas fa-users" /> {item.going}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  private calendar(): Mithril.Children {
    const year = this.month.getFullYear();
    const month = this.month.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const today = isoDay(new Date());
    const byDay = new Map<string, UpcomingItem[]>();

    for (const item of this.monthItems || []) {
      const key = isoDay(new Date(item.startsAt));
      byDay.set(key, [...(byDay.get(key) || []), item]);
    }

    // Os nomes dos dias da semana a partir de um domingo qualquer.
    const weekdays = Array.from({ length: 7 }, (_, i) => formatWith(new Date(2026, 0, 4 + i), { weekday: 'short' }).replace(/\./g, ''));
    const cells: Mithril.Children[] = [];

    for (let i = 0; i < offset; i++) cells.push(<div className="CanelaCalendar-cell CanelaCalendar-cell--empty" key={`e${i}`} />);

    for (let day = 1; day <= days; day++) {
      const key = isoDay(new Date(year, month, day));
      const items = byDay.get(key) || [];

      cells.push(
        <div className={classList('CanelaCalendar-cell', { 'CanelaCalendar-cell--today': key === today })} key={key}>
          <span className="CanelaCalendar-day">{day}</span>
          {items.map((item) => (
            <Link href={discussionHref(item)} className="CanelaCalendar-event" title={item.name || item.discussion.title || ''}>
              <span className="CanelaCalendar-time">{timeOf(new Date(item.startsAt))}</span> {item.name || item.discussion.title}
            </Link>
          ))}
        </div>
      );
    }

    return (
      <div className="CanelaCalendar">
        <div className="CanelaCalendar-nav">
          <Button
            className="Button Button--icon"
            icon="fas fa-chevron-left"
            aria-label={t('events.previous_month')}
            onclick={() => this.shiftMonth(-1)}
          />
          <h2>{formatWith(this.month, { month: 'long', year: 'numeric' })}</h2>
          <Button
            className="Button Button--icon"
            icon="fas fa-chevron-right"
            aria-label={t('events.next_month')}
            onclick={() => this.shiftMonth(1)}
          />
          <Button
            className="Button CanelaCalendar-today"
            onclick={() => {
              this.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
              this.loadMonth();
            }}
          >
            {t('events.today')}
          </Button>
        </div>
        {this.monthItems === null && <LoadingIndicator />}
        <div className="CanelaCalendar-grid">
          {weekdays.map((name) => (
            <div className="CanelaCalendar-weekday" key={`w${name}`}>
              {name}
            </div>
          ))}
          {cells}
        </div>
      </div>
    );
  }
}
