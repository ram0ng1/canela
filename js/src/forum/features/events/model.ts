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

/** Uma ocorrência da lista de próximos eventos (GET /api/canela-events). */
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
