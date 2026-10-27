/*
 * Os dados dos eventos como o servidor manda (extend/events.php): o cartão
 * inteiro no primeiro post (`canelaEvent` do post) e o resumo na discussão
 * (`canelaEvent` da discussão), mais as chaves do admin.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Tag from 'ext:flarum/tags/common/models/Tag';

import { forumBool, isExtensionEnabled } from '../../utils/settings';

export type RsvpStatus = 'going' | 'interested' | 'not_going';

/** Uma pessoa, só com o público. */
export interface EventPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
}

export interface EventSummary {
  id: number;
  name: string | null;
  startsAt: string;
  endsAt: string | null;
  ended: boolean;
  recurrence: string | null;
  timezone: string | null;
}

export interface EventData extends EventSummary {
  firstStartsAt: string;
  status: 'public' | 'standalone';
  recurrenceUntil: string | null;
  url: string | null;
  location: string | null;
  description: string | null;
  maxAttendees: number | null;
  chat: boolean;
  chatChannelId: number | null;
  going: number;
  interested: number;
  notGoing: number;
  full: boolean;
  myStatus: RsvpStatus | null;
  canRsvp: boolean;
  creator: EventPerson | null;
  sample: EventPerson[];
}

/** Uma ocorrência da lista de próximos eventos (a agenda, GET /api/canela-events). */
export interface UpcomingItem {
  id: number;
  name: string | null;
  startsAt: string;
  endsAt: string | null;
  recurrence: string | null;
  timezone: string | null;
  going: number;
  discussion: { id: string; title: string | null; slug: string | null };
}

interface ResourceObject {
  type: string;
  id: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, { data?: { type: string; id: string } | null }>;
}

/** Um documento do recurso `canela-events` (CalendarEventResource no PHP). */
export interface EventsDocument {
  data: ResourceObject | ResourceObject[];
  included?: ResourceObject[];
  meta?: Record<string, any>;
}

/** O cartão do evento de uma resposta do recurso (o cartão, a presença): os atributos, com o id. */
export function eventFromDocument(document: EventsDocument): EventData | null {
  const resource = Array.isArray(document.data) ? document.data[0] : document.data;

  return resource ? ({ ...(resource.attributes || {}), id: Number(resource.id) } as EventData) : null;
}

/**
 * A agenda como as telas a usam: uma linha por ocorrência, em ordem, com o
 * nome do evento (ou o título da discussão) e a discussão.
 */
export function upcomingFromDocument(document: EventsDocument): UpcomingItem[] {
  const discussions = new Map<string, Record<string, any>>();

  (document.included || []).forEach((item) => {
    if (item.type === 'discussions') discussions.set(item.id, item.attributes || {});
  });

  const items: UpcomingItem[] = [];

  (Array.isArray(document.data) ? document.data : [document.data]).forEach((event) => {
    const attributes = event.attributes || {};
    const discussionId = event.relationships?.discussion?.data?.id || '';
    const discussion = discussions.get(discussionId) || {};

    ((attributes.occurrences || []) as { startsAt: string; endsAt: string | null }[]).forEach((occurrence) => {
      items.push({
        id: Number(event.id),
        name: attributes.name || discussion.title || null,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        recurrence: attributes.recurrence ?? null,
        timezone: attributes.timezone ?? null,
        going: attributes.going ?? 0,
        discussion: { id: discussionId, title: discussion.title ?? null, slug: discussion.slug ?? null },
      });
    });
  });

  return items.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));
}

export const eventsSettings = {
  /** O backend carregado e o recurso ligado. */
  on: () => forumBool('canelaEventsBackend', false) && forumBool('canelaEventsEnabled', true),
  /** O id da tag dos eventos ('' = qualquer discussão). */
  tagId: (): string => String(app.forum?.attribute('canelaEventsTag') || ''),
  chat: () => eventsSettings.on() && forumBool('canelaEventsChat', true) && isExtensionEnabled('ramon-chat'),
  dockedChat: () => eventsSettings.chat() && forumBool('canelaEventsDockedChat', true),
  listBadge: () => eventsSettings.on() && forumBool('canelaEventsListBadge', true),
  upcoming: () => eventsSettings.on() && forumBool('canelaEventsUpcoming', true),
};

/** A tag dos eventos, quando escolhida e carregada. */
export function eventsTag(): Tag | null {
  const id = eventsSettings.tagId();

  return id && isExtensionEnabled('flarum-tags') ? app.store.getById<Tag>('tags', id) || null : null;
}

/** As tags dadas incluem a dos eventos (sem tag escolhida, sempre). */
export function tagsAllowEvents(tags: Tag[] | null | undefined): boolean {
  const id = eventsSettings.tagId();

  if (!id || !isExtensionEnabled('flarum-tags')) return true;

  return (tags || []).some((tag) => tag && tag.id() === id);
}

export function postEvent(post: Post | null | undefined): EventData | null {
  return (post?.attribute<EventData | null>('canelaEvent') as EventData | null) || null;
}

export function discussionEvent(discussion: Discussion | null | undefined): EventSummary | null {
  return (discussion?.attribute<EventSummary | null>('canelaEvent') as EventSummary | null) || null;
}

/** A pessoa como modelo do store (para o Avatar e o link do perfil). */
export function personModel(person: EventPerson): User {
  const existing = app.store.getById<User>('users', person.id);

  if (existing) return existing;

  return app.store.pushObject<User>({
    type: 'users',
    id: person.id,
    attributes: { username: person.username, displayName: person.displayName, avatarUrl: person.avatarUrl, slug: person.slug },
  } as any) as User;
}

export function apiUrl(path: string): string {
  return `${app.forum.attribute<string>('apiUrl')}${path}`;
}
