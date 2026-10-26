import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
export interface TocHeading {
    id: string;
    level: number;
    text: string;
    children: TocHeading[];
}
export declare function tocOn(): boolean;
export declare function tocVisible(): boolean;
export declare function toggleToc(): void;
/** O primeiro post: a relação da discussão ou o primeiro id do tópico. */
export declare function firstPostOf(discussion: Discussion): Post | null;
/** Os títulos do post, em árvore, com os mesmos ids das âncoras. */
export declare function postHeadings(post: Post): {
    tree: TocHeading[];
    count: number;
    marker: boolean;
};
/** O sumário vale nesta discussão (e o primeiro post já está carregado). */
export declare function tocFor(discussion: Discussion | null | undefined): {
    post: Post;
    tree: TocHeading[];
} | null;
/** Vai até o título (carregando o primeiro post antes, se ele não estiver na página). */
export declare function goToHeading(id: string, stream: any): void;
export interface TocAttrs extends ComponentAttrs {
    post: Post;
    tree: TocHeading[];
    stream: any;
}
export default class TableOfContents extends Component<TocAttrs> {
    private active;
    private ancestors;
    private onScroll;
    private frame;
    oncreate(vnode: Mithril.VnodeDOM<TocAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<TocAttrs, this>): void;
    /** O título de agora: o último cujo topo já passou da linha do cabeçalho + folga. */
    private track;
    private list;
    view(): Mithril.Children;
    /** "Ir para o fim": o fim do primeiro post (logo acima dos botões dele). */
    private jumpToEnd;
}
/** "Linha de tempo" / "Conteúdo": a troca entre os dois. */
export declare function tocToggle(): Mithril.Children;
