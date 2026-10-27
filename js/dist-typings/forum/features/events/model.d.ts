import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Tag from 'ext:flarum/tags/common/models/Tag';
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
    discussion: {
        id: string;
        title: string | null;
        slug: string | null;
    };
}
interface ResourceObject {
    type: string;
    id: string;
    attributes?: Record<string, any>;
    relationships?: Record<string, {
        data?: {
            type: string;
            id: string;
        } | null;
    }>;
}
/** Um documento do recurso `canela-events` (CalendarEventResource no PHP). */
export interface EventsDocument {
    data: ResourceObject | ResourceObject[];
    included?: ResourceObject[];
    meta?: Record<string, any>;
}
/** O cartão do evento de uma resposta do recurso (o cartão, a presença): os atributos, com o id. */
export declare function eventFromDocument(document: EventsDocument): EventData | null;
/**
 * A agenda como as telas a usam: uma linha por ocorrência, em ordem, com o
 * nome do evento (ou o título da discussão) e a discussão.
 */
export declare function upcomingFromDocument(document: EventsDocument): UpcomingItem[];
export declare const eventsSettings: {
    /** O backend carregado e o recurso ligado. */
    on: () => boolean;
    /** O id da tag dos eventos ('' = qualquer discussão). */
    tagId: () => string;
    chat: () => boolean;
    dockedChat: () => boolean;
    listBadge: () => boolean;
    upcoming: () => boolean;
};
/** A tag dos eventos, quando escolhida e carregada. */
export declare function eventsTag(): Tag | null;
/** As tags dadas incluem a dos eventos (sem tag escolhida, sempre). */
export declare function tagsAllowEvents(tags: Tag[] | null | undefined): boolean;
export declare function postEvent(post: Post | null | undefined): EventData | null;
export declare function discussionEvent(discussion: Discussion | null | undefined): EventSummary | null;
/** A pessoa como modelo do store (para o Avatar e o link do perfil). */
export declare function personModel(person: EventPerson): User;
export declare function apiUrl(path: string): string;
export {};
