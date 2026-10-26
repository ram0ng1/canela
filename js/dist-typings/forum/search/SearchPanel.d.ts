import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import { type CanelaTag } from '../utils/tags';
import { type QuickTip } from './assist';
import { type default as SearchMenu } from './SearchMenu';
export { trigger } from './engine';
interface AssistantItemOpts {
    typeClass?: string;
    icon?: string;
    slug?: string;
    keyword?: string;
    concatSlug?: boolean;
    label?: Mithril.Children;
    suffix?: string;
    extraHint?: boolean;
    withInLabel?: boolean;
    category?: CanelaTag;
    tag?: CanelaTag;
    user?: User;
    searchAllTopics?: boolean;
}
export interface SearchPanelAttrs extends ComponentAttrs {
    menu: SearchMenu;
}
export default class SearchPanel extends Component<SearchPanelAttrs> {
    protected tip: QuickTip | null;
    oninit(vnode: Mithril.Vnode<SearchPanelAttrs, this>): void;
    view(): Mithril.Children;
    resultsView(): Mithril.Children;
    /** "Perguntar à IA: termo", no topo do painel. */
    askAi(term: string): Mithril.Children;
    /** O texto antes da palavra-chave da sugestão (`AssistantItem.prefix`). */
    itemPrefix(keyword?: string): string;
    assistantItem(opts: AssistantItemOpts): Mithril.Children;
    /** `search-menu/results/assistant.gjs`: categorias e etiquetas, usuários ou atalhos. */
    assistant(): Mithril.Children;
    /** "pai:filha", a forma escrita da subcategoria. */
    tagSlug(tag: CanelaTag): string;
    /** A página de categoria (ou etiqueta) é o contexto da busca. */
    contextItem(): Mithril.Children;
    /** `search-menu/results/initial-options.gjs`. */
    initialOptions(): Mithril.Children;
    randomTip(): Mithril.Children;
    recentSearches(): Mithril.Children;
    resultLink(href: string, content: Mithril.Children, className?: string): Mithril.Children;
    quickResults(): Mithril.Children;
    /** `search-menu/results/type/user.gjs`: avatar pequeno, nome (em negrito) e @usuário. */
    userView(user: User, withName: boolean): Mithril.Children;
    topicResults(topics: Discussion[], text: string): Mithril.Children;
    /** Os ícones cinza pequenos antes do título (`TopicStatus`): trancado e fixado. */
    topicStatuses(discussion: Discussion): Mithril.Children;
    /** `search-menu/results/more-link.gjs`: "Mais..." leva à busca de página inteira. */
    moreLink(more: boolean): Mithril.Children;
}
