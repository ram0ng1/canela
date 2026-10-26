import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import { type Box } from './util';
export interface MessagesNavAttrs extends ComponentAttrs {
    user: User;
    box: Box;
    /** Depois de enviar uma mensagem nova, para a lista se atualizar. */
    onsent?: () => void;
}
export default class MessagesNav extends Component<MessagesNavAttrs> {
    view(): Mithril.Children;
    label(box: Box): string;
    /**
     * "Caixa de entrada ▾" (`messages-dropdown`, um botão padrão): a bolinha
     * aparece quando há novas ou não lidas, como o `d-icon-d-unread` de quem
     * não pediu as contagens na barra lateral.
     */
    inboxDropdown(user: User): Mithril.Children;
}
