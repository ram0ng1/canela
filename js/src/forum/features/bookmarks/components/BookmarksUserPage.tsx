/*
 * A aba "Marcadores" do perfil (`/u/:username/bookmarks`), como a lista de
 * marcadores do Discourse: busca no topo e, por marcador, o tópico (com
 * categoria e etiquetas), o nome e o lembrete, o trecho do post, quando foi
 * marcado e o menu "…" com Editar, Tirar lembrete e Excluir.
 *
 * Marcadores são pessoais: a aba só aparece no próprio perfil, e no perfil de
 * outra pessoa a página só avisa — a API, de qualquer forma, só devolve os
 * marcadores de quem pede.
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import type Bookmark from '../Bookmark';
import { bookmarksEnabled, clearPost, updateBookmark } from '../actions';
import { reminderLabel } from '../reminders';
import { discussionBadges, isTagsEnabled } from '../../../utils/tags';
import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

export default class BookmarksUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  bookmarks: Bookmark[] = [];
  // Começa carregando: o primeiro desenho vem antes do pedido, e "nenhum
  // marcador" piscaria antes da lista.
  loading = true;
  moreResults = false;
  query = '';

  private loadedFor: User | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** Cada busca invalida as respostas das anteriores que ainda estão a caminho. */
  private requestId = 0;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  onremove(vnode: Mithril.VnodeDOM<Attrs, this>) {
    super.onremove(vnode);

    clearTimeout(this.searchTimer);
  }

  show(user: User): void {
    super.show(user);

    // `show()` roda de novo quando o perfil completo chega.
    if (this.loadedFor === user || !this.isOwnProfile()) return;

    this.loadedFor = user;
    this.refresh();
  }

  isOwnProfile(): boolean {
    return !!this.user && app.session.user === this.user;
  }

  content(): Mithril.Children {
    if (!bookmarksEnabled() || !this.isOwnProfile()) {
      return <p className="CanelaBookmarks-private">{t('bookmarks.page.private')}</p>;
    }

    return (
      <div className="CanelaBookmarks">
        <div className="CanelaBookmarks-toolbar">{this.toolbarItems().toArray()}</div>
        {this.listView()}
      </div>
    );
  }

  toolbarItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add(
      'search',
      <div className="CanelaBookmarks-search">
        <Icon name="fas fa-search" className="CanelaBookmarks-searchIcon" />
        <input
          className="FormControl"
          type="search"
          value={this.query}
          placeholder={t('bookmarks.page.search_placeholder')}
          aria-label={t('bookmarks.page.search_placeholder')}
          oninput={(event: InputEvent) => this.search((event.target as HTMLInputElement).value)}
        />
      </div>,
      100
    );

    return items;
  }

  listView(): Mithril.Children {
    const bookmarks = this.bookmarks.filter((bookmark) => bookmark.exists);

    if (this.loading && !bookmarks.length) return <LoadingIndicator display="block" />;

    if (!bookmarks.length) {
      return (
        <div className="CanelaBookmarks-empty">
          <Icon name="far fa-bookmark" className="CanelaBookmarks-emptyIcon" />
          <p>{this.query ? t('bookmarks.page.no_results', { query: this.query }) : t('bookmarks.page.empty')}</p>
          {!this.query && <p className="CanelaBookmarks-emptyHelp">{t('bookmarks.page.empty_help')}</p>}
        </div>
      );
    }

    return (
      <div className="CanelaBookmarkList" role="table" aria-label={t('bookmarks.page.title')}>
        <div className="CanelaBookmarkList-head" role="row">
          <span className="CanelaBookmarkList-headTopic" role="columnheader">
            {t('bookmarks.page.column_topic')}
          </span>
          <span className="CanelaBookmarkList-headDate" role="columnheader">
            {t('bookmarks.page.column_date')}
          </span>
          <span className="CanelaBookmarkList-headActions" role="columnheader" />
        </div>
        <ul className="CanelaBookmarkList-items" role="rowgroup">
          {bookmarks.map((bookmark) => this.item(bookmark))}
        </ul>
        {this.moreResults && (
          <div className="CanelaBookmarkList-more">
            <Button className="Button" loading={this.loading} onclick={() => this.loadMore()}>
              {t('bookmarks.page.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  item(bookmark: Bookmark): Mithril.Children {
    const post = bookmark.post() || null;
    const discussion = post ? post.discussion() : null;

    // Excluído pelo modal "Editar marcador" (que não conhece esta lista).
    if (!bookmark.exists || !post || !discussion) return null;

    const createdAt = bookmark.createdAt();
    const reminderAt = bookmark.reminderAt();
    const expired = !!reminderAt && (!!bookmark.remindedAt() || reminderAt.getTime() <= Date.now());
    const excerpt = post.contentPlain();

    return (
      <li className="CanelaBookmarkList-item" role="row" key={bookmark.id()}>
        <div className="CanelaBookmarkList-main" role="cell">
          <Avatar user={post.user() || null} className="CanelaBookmarkList-avatar" />
          <div className="CanelaBookmarkList-body">
            <Link className="CanelaBookmarkList-title" href={app.route.post(post)}>
              <Icon name="fas fa-bookmark" className="CanelaBookmarkList-titleIcon" />
              {discussion.title()}
            </Link>

            {isTagsEnabled() && <div className="CanelaBookmarkList-badges">{discussionBadges(discussion)}</div>}

            {(bookmark.name() || reminderAt) && (
              <div className="CanelaBookmarkList-meta">
                {bookmark.name() && (
                  <span className="CanelaBookmarkList-metaItem CanelaBookmarkList-name">
                    <Icon name="fas fa-tag" />
                    <span>{bookmark.name()}</span>
                  </span>
                )}
                {reminderAt && (
                  <span
                    className={classList('CanelaBookmarkList-metaItem CanelaBookmarkList-reminder', { 'is-expired': expired })}
                    title={fullDate(reminderAt)}
                  >
                    <Icon name="far fa-clock" />
                    <span>{t(expired ? 'bookmarks.page.reminder_past' : 'bookmarks.page.reminder_future', { date: reminderLabel(reminderAt) })}</span>
                  </span>
                )}
              </div>
            )}

            {excerpt && <p className="CanelaBookmarkList-excerpt">{truncate(excerpt, 220)}</p>}
          </div>
        </div>

        <div className="CanelaBookmarkList-date" role="cell">
          {createdAt && (
            <time datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
              {shortAge(createdAt)}
            </time>
          )}
        </div>

        <div className="CanelaBookmarkList-actions" role="cell">
          <Dropdown
            className="CanelaBookmarkList-menu"
            buttonClassName="Button Button--icon Button--flat"
            menuClassName="Dropdown-menu--right"
            icon="fas fa-ellipsis-h"
            caretIcon=""
            label=""
            accessibleToggleLabel={t('bookmarks.page.actions')}
          >
            {this.actionItems(bookmark, post).toArray()}
          </Dropdown>
        </div>
      </li>
    );
  }

  actionItems(bookmark: Bookmark, post: Post): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add(
      'edit',
      <Button icon="fas fa-pencil-alt" onclick={() => app.modal.show(() => import('./BookmarkModal'), { post })}>
        {t('bookmarks.page.edit')}
      </Button>,
      100
    );

    if (bookmark.reminderAt()) {
      items.add(
        'clearReminder',
        <Button icon="far fa-bell-slash" onclick={() => updateBookmark(post, bookmark, { reminderAt: null }).catch(() => {})}>
          {t('bookmarks.page.clear_reminder')}
        </Button>,
        90
      );
    }

    items.add(
      'delete',
      <Button icon="far fa-trash-alt" className="CanelaBookmarkList-delete" onclick={() => this.remove(bookmark, post)}>
        {t('bookmarks.page.delete')}
      </Button>,
      -100
    );

    return items;
  }

  search(value: string): void {
    this.query = value;

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh(), SEARCH_DELAY_MS);
  }

  refresh(): void {
    this.bookmarks = [];
    this.load(0);
  }

  loadMore(): void {
    this.load(this.bookmarks.length);
  }

  load(offset: number): void {
    const requestId = ++this.requestId;
    const include = ['post', 'post.discussion', 'post.user'];

    // As etiquetas só existem com o flarum/tags: pedi-las sem ele derruba o pedido inteiro.
    if (isTagsEnabled()) include.push('post.discussion.tags');

    this.loading = true;
    m.redraw();

    app.store
      .find<Bookmark[]>('bookmarks', {
        filter: this.query.trim() ? { q: this.query.trim() } : {},
        include: include.join(','),
        page: { offset, limit: PAGE_SIZE },
      } as any)
      .then((results: any) => {
        if (requestId !== this.requestId) return;

        this.bookmarks = offset ? [...this.bookmarks, ...results] : results.slice();
        this.moreResults = !!results.payload?.links?.next;
      })
      .catch(() => {})
      .finally(() => {
        if (requestId !== this.requestId) return;

        this.loading = false;
        m.redraw();
      });
  }

  remove(bookmark: Bookmark, post: Post): void {
    // Com lembrete marcado, apagar perde também o lembrete: o Discourse pede
    // confirmação nesse caso, e só nele.
    if (bookmark.hasPendingReminder() && !window.confirm(t('bookmarks.page.delete_confirm'))) return;

    bookmark
      .delete()
      .then(() => {
        clearPost(post);
        this.bookmarks = this.bookmarks.filter((other) => other !== bookmark);
        app.alerts.show({ type: 'success' }, t('bookmarks.alerts.removed'));
      })
      .catch(() => {})
      .finally(() => m.redraw());
  }
}
