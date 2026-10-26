import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import { type NotificationFilter } from './notifications';
export interface UserMenuTab {
    /** Único entre as abas; vira `#quick-access-{id}` e `#user-menu-button-{id}`. */
    id: string;
    /** O ícone da aba (um `menuIcon(...)` ou qualquer vnode). */
    icon: Mithril.Children;
    /** Rótulo para `title`/`aria-label` (sem o número). */
    title: string;
    /** Rótulo com o número de não lidas, quando houver. */
    titleWithUnread?: (count: number) => string;
    /** O número da bolha da aba; zero esconde. */
    count?: () => number;
    /** Clicar na aba já ativa leva a esta página (o `linkWhenActive`). */
    href?: () => string | null;
    /** Os tipos de notificação da aba (saem de "Outras notificações"). */
    types?: string[];
    /** Aba de notificações filtradas: também vira aba na página /notifications. */
    filter?: NotificationFilter;
    /** Rótulo curto da aba na página /notifications. */
    pageLabel?: string;
    /** O conteúdo da aba. */
    panel: () => Mithril.Children;
}
export interface UserMenuAttrs extends ComponentAttrs {
}
export default class UserMenu extends Component<UserMenuAttrs> {
    view(): JSX.Element;
    oncreate(vnode: Mithril.VnodeDOM<UserMenuAttrs, this>): void;
    /**
     * As abas de cima, nesta ordem: todas, respostas, curtidas,
     * mensagens, marcadores, (abas de extensões), revisão e "outras".
     */
    tabItems(): ItemList<UserMenuTab>;
    /** As abas de cima mais a "Outras notificações", com os tipos que sobraram. */
    resolvedTopTabs(): UserMenuTab[];
    otherTab(used: string[]): UserMenuTab;
    bottomTabItems(): ItemList<UserMenuTab>;
    /**
     * Os itens da aba Perfil: tudo o que o menu da sessão oferece (core, tema
     * e extensões), mais o que o Flarum não tem ali: status,
     * Resumo, Atividade, Mensagens e o modo claro/escuro.
     */
    profileItems(): ItemList<Mithril.Children>;
    tabButton(tab: UserMenuTab, position: number): Mithril.Children;
    /**
     * Numa aba já ativa (ou abrindo em
     * nova aba) o link segue para a página completa; nas outras, só troca o
     * conteúdo.
     */
    selectTab(tab: UserMenuTab, e: MouseEvent | KeyboardEvent): void;
    /** Setas para cima e para baixo percorrem as abas (`role="tablist"` vertical). */
    onkeydown(e: KeyboardEvent): void;
}
