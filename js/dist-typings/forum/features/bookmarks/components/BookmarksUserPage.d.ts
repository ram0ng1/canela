import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import type Bookmark from '../Bookmark';
export default class BookmarksUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    bookmarks: Bookmark[];
    loading: boolean;
    moreResults: boolean;
    query: string;
    private loadedFor;
    private searchTimer;
    /** Cada busca invalida as respostas das anteriores que ainda estão a caminho. */
    private requestId;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<Attrs, this>): void;
    show(user: User): void;
    isOwnProfile(): boolean;
    content(): Mithril.Children;
    toolbarItems(): ItemList<Mithril.Children>;
    listView(): Mithril.Children;
    item(bookmark: Bookmark): Mithril.Children;
    actionItems(bookmark: Bookmark, post: Post): ItemList<Mithril.Children>;
    search(value: string): void;
    refresh(): void;
    loadMore(): void;
    load(offset: number): void;
    remove(bookmark: Bookmark, post: Post): void;
}
