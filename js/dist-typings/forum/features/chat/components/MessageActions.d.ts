import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type ChatPane } from '../ChatStore';
import type { ChatMessage } from '../types';
export interface MessageActionsAttrs extends ComponentAttrs {
    message: ChatMessage;
    pane: ChatPane;
    context: string;
    hidden?: boolean;
}
interface SecondaryAction {
    id: string;
    icon: string;
    label: string;
    run: () => void;
}
/** O que o leitor pode fazer com a mensagem. */
export declare function secondaryActions(message: ChatMessage, pane: ChatPane, phone?: boolean): SecondaryAction[];
export default class MessageActions extends Component<MessageActionsAttrs> {
    view(): Mithril.Children;
    /** A folha do celular, aberta ao segurar a mensagem. */
    static openSheet(message: ChatMessage, pane: ChatPane, _context: string): void;
}
export {};
