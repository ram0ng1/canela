/*
 * "Próximos eventos": as próximas ocorrências, com o bloco da data, o nome e
 * a hora. Aparece no topo da lista da
 * tag dos eventos e leva à página de todos os eventos.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import type Mithril from 'mithril';

import { monthShort, timeOf } from './format';
import { apiUrl, upcomingFromDocument, type EventsDocument, type UpcomingItem } from './model';
import { EVENTS_ROUTE } from './route';
import { t } from '../../utils/settings';

export interface UpcomingEventsAttrs extends ComponentAttrs {
  limit?: number;
}

/** Os mesmos pedidos por 60 s: a lista da tag redesenha muito. */
let cache: { at: number; items: UpcomingItem[] } | null = null;
let pending: Promise<UpcomingItem[]> | null = null;

export interface UpcomingParams {
  /** AAAA-MM-DD; sem ela, de agora. */
  from?: string;
  /** AAAA-MM-DD; sem ela, um ano depois de `from`. */
  to?: string;
  /** Quantas ocorrências (não eventos), até 200. */
  limit?: number;
}

export function loadUpcoming({ from, to, limit }: UpcomingParams = {}): Promise<UpcomingItem[]> {
  const filter: Record<string, string> = {};

  if (from) filter.from = from;
  if (to) filter.to = to;

  return app
    .request<EventsDocument>({
      method: 'GET',
      url: apiUrl('/canela-events'),
      params: {
        filter,
        page: limit ? { limit } : {},
        include: 'discussion',
        // Da discussão, só o que a linha mostra (o título) e o link (o slug).
        fields: { discussions: 'title,slug' },
      },
    })
    .then((payload) => upcomingFromDocument(payload))
    .catch(() => []);
}

function upcoming(): Promise<UpcomingItem[]> {
  if (cache && Date.now() - cache.at < 60000) return Promise.resolve(cache.items);

  pending ||= loadUpcoming({ limit: 6 }).then((items) => {
    cache = { at: Date.now(), items };
    pending = null;

    return items;
  });

  return pending;
}

export function discussionHref(item: UpcomingItem): string {
  return app.route('discussion', { id: item.discussion.slug ? `${item.discussion.id}-${item.discussion.slug}` : item.discussion.id });
}

export default class UpcomingEvents extends Component<UpcomingEventsAttrs> {
  private items: UpcomingItem[] | null = cache?.items ?? null;

  oninit(vnode: Mithril.Vnode<UpcomingEventsAttrs, this>) {
    super.oninit(vnode);

    upcoming().then((items) => {
      this.items = items;
      m.redraw();
    });
  }

  view(): Mithril.Children {
    const items = (this.items || []).slice(0, this.attrs.limit || 4);

    if (!items.length) return null;

    return (
      <section className="CanelaUpcomingEvents">
        <header className="CanelaUpcomingEvents-header">
          <Icon name="far fa-calendar" />
          <h3>{t('events.upcoming_title')}</h3>
          <Link className="CanelaUpcomingEvents-all" href={app.route(EVENTS_ROUTE)}>
            {t('events.all_events')}
          </Link>
        </header>
        <ul className="CanelaUpcomingEvents-list">
          {items.map((item) => {
            const start = new Date(item.startsAt);

            return (
              <li key={`${item.id}-${item.startsAt}`}>
                <Link href={discussionHref(item)} className="CanelaUpcomingEvents-item">
                  <span className="CanelaUpcomingEvents-date" aria-hidden="true">
                    <span className="CanelaUpcomingEvents-month">{monthShort(start)}</span>
                    <span className="CanelaUpcomingEvents-day">{start.getDate()}</span>
                  </span>
                  <span className="CanelaUpcomingEvents-info">
                    <span className="CanelaUpcomingEvents-name">{item.name || item.discussion.title}</span>
                    <span className="CanelaUpcomingEvents-time">{timeOf(start)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
}
