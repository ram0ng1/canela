import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type BoxListState from './BoxListState';
import { type Dialog } from './util';
export interface MessagesListAttrs extends ComponentAttrs {
    state: BoxListState;
    /** O estado vazio da caixa (título e texto). */
    empty: () => Mithril.Children;
}
export default class MessagesList extends Component<MessagesListAttrs> {
    view(): Mithril.Children;
    row(dialog: Dialog, showViews: boolean): Mithril.Children;
    /** A bolinha de "nova" ou a pílula com as não lidas, como na lista de tópicos. */
    unreadBadge(dialog: Dialog, unread: number, neverRead: boolean): Mithril.Children;
    /**
     * Os participantes de uma mensagem: todos, até 5 — o
     * flarum/messages manda no máximo 5 —, e quem escreveu por último em
     * destaque.
     */
    posters(dialog: Dialog, lastUser: User | null): Mithril.Children;
    avatar(user: User | null): Mithril.Children;
}
