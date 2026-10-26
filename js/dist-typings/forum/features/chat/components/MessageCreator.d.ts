import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type { ChatChannel } from '../types';
export interface MessageCreatorAttrs extends ComponentAttrs {
    inDrawer: boolean;
    /** Modo "Adicionar membros" de um canal existente. */
    addTo?: ChatChannel;
    onadded?: () => void;
}
export default class MessageCreator extends Component<MessageCreatorAttrs> {
    private query;
    private users;
    private index;
    private group;
    private members;
    private groupName;
    private busy;
    private request;
    oninit(vnode: Mithril.Vnode<MessageCreatorAttrs, this>): void;
    view(): Mithril.Children;
    private input;
    private items;
    private row;
    private keydown;
    private toggleMember;
    private search;
    private open;
    private addMembers;
}
