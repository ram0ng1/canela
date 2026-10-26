import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type { ChatRoute } from '../types';
export interface RouteViewAttrs extends ComponentAttrs {
    route: ChatRoute;
    inDrawer: boolean;
    /** Na página cheia do computador a lista mora na barra lateral: sem "voltar". */
    sideList?: boolean;
}
export default class RouteView extends Component<RouteViewAttrs> {
    private loadingChannel;
    private missing;
    view(): Mithril.Children;
    private listTitle;
    private listBody;
    /** Na página cheia: "Fechar chat em tela cheia" leva a conversa para a gaveta. */
    private pageButtons;
    private loadChannel;
    private back;
    private channelRoute;
    private threadRoute;
    private setLevel;
    private channelSubRoute;
}
