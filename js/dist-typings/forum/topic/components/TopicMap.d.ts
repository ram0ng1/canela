import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import { type TopicLink } from '../../features/links/data';
export interface TopicMapAttrs extends ComponentAttrs {
    discussion: Discussion;
    /** 'op' abaixo do primeiro post; 'bottom' no fim do tópico. */
    position?: 'op' | 'bottom';
}
type MenuKey = 'views' | 'likes' | 'links' | 'users';
/** Sem respostas nem visualizações o mapa só repetiria o cabeçalho do post. */
export declare function hasTopicMap(discussion: Discussion): boolean;
export declare function hasBottomTopicMap(discussion: Discussion): boolean;
export default class TopicMap extends Component<TopicMapAttrs> {
    open: MenuKey | null;
    closer?: (event: Event) => void;
    onremove(vnode: Mithril.VnodeDOM<TopicMapAttrs, this>): void;
    view(): JSX.Element;
    stat(key: string, value: number, label: string, menu?: MenuKey): Mithril.Children;
    /** O menu de visualizações abre já com os números (TopicViewsMenu). */
    prefetchViews(event: Event & {
        redraw?: boolean;
    }, views: number): void;
    toggle(menu: MenuKey, trigger: HTMLElement): void;
    anchorLeft: number;
    close(): void;
    unlisten(): void;
    menu(className: string, title: string, body: Mithril.Children): Mithril.Children;
    /** "Visualizações recentes": o gráfico por dia (ou os números, com até dois dias). */
    viewsMenu(discussion: Discussion, views: number): Mithril.Children;
    /** As respostas mais curtidas (o primeiro post não conta). */
    likesMenu(posts: Post[]): Mithril.Children;
    /** Mostra todos os links no menu, e não só os primeiros. */
    allLinks: boolean;
    /** "Links populares": cliques, título (ou endereço) e domínio, os mais clicados primeiro. */
    linksMenu(discussion: Discussion, links: TopicLink[]): Mithril.Children;
    usersMenu(top: {
        user: User;
        count: number;
    }[]): Mithril.Children;
}
export {};
