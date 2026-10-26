import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import { type EventData, type RsvpStatus } from './model';
export interface EventCardAttrs extends ComponentAttrs {
    post: Post;
    /** A descrição que o servidor desenhou, levada para dentro do cartão. */
    description: HTMLElement | null;
}
export declare function rsvp(post: Post, event: EventData, status: RsvpStatus | null): Promise<void>;
export default class EventCard extends Component<EventCardAttrs> {
    private busy;
    oncreate(vnode: Mithril.VnodeDOM<EventCardAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<EventCardAttrs, this>): void;
    /** A descrição do servidor entra na seção dela (uma vez; o nó fica lá). */
    private placeDescription;
    view(): Mithril.Children;
    /** O chat já está ao lado do tópico (o modo encaixado, no computador). */
    private chatDocked;
    private urlLabel;
    private invitees;
    private moreMenu;
    private actions;
}
