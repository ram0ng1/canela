import Component from 'flarum/common/Component';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import { type ChatReport } from '../thirdparty/ramonChat/features/reviewData';
type ReviewFilter = 'all' | 'flagged' | 'queued' | 'chat';
export default class ReviewQueue extends Component {
    /** Uma sinalização por post (a API agrupa por post); o post traz todas. */
    posts: Post[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    offset: number;
    filter: ReviewFilter;
    busy: Set<string>;
    expanded: Set<string>;
    /** As mensagens do chat denunciadas (uma entrada por mensagem). */
    chatReports: ChatReport[];
    chatLoading: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    loadChat(): void;
    /** Quando o post entrou na fila: a sinalização mais nova, ou o próprio post (na aprovação). */
    postDate(post: Post): number;
    /** Posts e mensagens do chat juntos, do mais recente ao mais antigo. */
    entries(): Mithril.Children[];
    load(more?: boolean): void;
    visiblePosts(): Post[];
    view(): JSX.Element;
    filters(): Mithril.Children;
    countFor(filter: ReviewFilter): number;
    item(post: Post): Mithril.Children;
    /** "Inadequado ×2" — os motivos somados, como o `.review-item__flag-badges`. */
    reasonChips(flags: any[]): Mithril.Children;
    /** Quem sinalizou, o motivo, quando e a mensagem (o `.reviewable-scores`). */
    scores(flags: any[]): Mithril.Children;
    flaggedActions(post: Post): Mithril.Children;
    queuedActions(post: Post): Mithril.Children;
    /** Excluir o primeiro post é excluir o tópico. */
    canDelete(post: Post): boolean;
    run(post: Post, action: () => Promise<unknown>, doneKey: string): void;
    confirmDelete(post: Post, doneKey: string, question?: string): void;
    dismiss(post: Post): Promise<unknown>;
    hide(post: Post): Promise<unknown>;
    restore(post: Post): Promise<unknown>;
    approve(post: Post): Promise<unknown>;
    delete(post: Post): Promise<unknown>;
    /** Sai da fila; o contador do menu e a lista do `app.flags` acompanham. */
    resolved(post: Post): void;
}
export {};
