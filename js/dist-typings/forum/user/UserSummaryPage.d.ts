import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
interface SummaryUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    color: string | null;
    count: number;
}
interface SummaryCategory {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
    topics: number;
    replies: number;
}
interface SummaryLink {
    url: string;
    title: string | null;
    domain: string;
    clicks: number;
    postNumber: number;
    discussionId: string;
    discussionSlug: string;
    discussionTitle: string;
}
interface SummaryExtra {
    mostRepliedTo: SummaryUser[] | null;
    mostLikedBy: SummaryUser[] | null;
    mostLiked: SummaryUser[] | null;
    topCategories: SummaryCategory[] | null;
    /** Recurso `links`: null com ele desligado. */
    topLinks?: SummaryLink[] | null;
}
export default class UserSummaryPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    topics: Discussion[] | null;
    replies: Post[] | null;
    likesGiven: number | null;
    /** As listas do backend do resumo (recurso `usersummary`); null sem ele. */
    extra: SummaryExtra | null;
    /** O usuário cujos dados já foram pedidos: `show()` roda de novo quando o perfil completo chega. */
    private loadedFor;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    show(user: User): void;
    likesEnabled(): boolean;
    load(user: User): void;
    content(): Mithril.Children;
    sectionItems(): ItemList<Mithril.Children>;
    /** `.summary-user-list`: avatar, nome de usuário e nome, e a contagem embaixo. */
    userSection(name: string, heading: string, users: SummaryUser[], icon: string, emptyText?: string): Mithril.Children;
    /** `.top-links`: os cliques, o link (título ou endereço) e o tópico onde ele está. */
    linksSection(links: SummaryLink[]): Mithril.Children;
    /** `.top-categories-section`: a categoria, os tópicos e as respostas. */
    categoriesSection(categories: SummaryCategory[]): Mithril.Children;
    statItems(): ItemList<Mithril.Children>;
    /** "7 meses tempo de leitura": o valor já formatado. */
    statText(value: string, label: string): Mithril.Children;
    /** "1,9k dias acessados": o número abreviado, com o exato no title. */
    stat(value: number, label: string, title?: string, icon?: string): Mithril.Children;
    list<T>(models: T[] | null, render: (model: T) => Mithril.Children, emptyText: string): Mithril.Children;
    /** "abr 2022 · ♡ 15" em cima, o título do tópico embaixo. */
    meta(date: Date | undefined | null, likes: number | null, replies?: number): Mithril.Children;
    topicItem(discussion: Discussion): Mithril.Children;
    replyItem(post: Post): Mithril.Children;
}
export {};
