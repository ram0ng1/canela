/*
 * "N postagens no tópico" do cartão de usuário: o tópico passa a
 * mostrar só os posts daquela pessoa, com a faixa "Mostrando N postagens de
 * @fulano · Ver tudo" no topo.
 *
 * O PostStream do core não sabe filtrar; o tema carrega todos os posts do
 * tópico de uma vez (o stream fica com a janela inteira) e esconde os dos
 * outros pelo CSS. "Ver tudo" só tira o filtro: os posts já estão lá.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';

import { t } from '../utils/settings';

/** Acima disso carregar tudo de uma vez pesaria demais: o filtro não aparece. */
export const AUTHOR_FILTER_MAX_POSTS = 500;

export const authorFilter: { discussionId: string | null; user: User | null; count: number; loading: boolean } = {
  discussionId: null,
  user: null,
  count: 0,
  loading: false,
};

/** Quantos posts (comentários visíveis) a pessoa tem entre os já carregados do tópico. */
export function authorPostCount(discussion: Discussion, user: User): number {
  return discussion
    .postIds()
    .map((id) => app.store.getById<Post>('posts', id))
    .filter((post) => post && post.contentType() === 'comment' && !post.isHidden() && post.user() === user).length;
}

export function filterByAuthor(stream: any, discussion: Discussion, user: User): void {
  if (!stream || discussion.postIds().length > AUTHOR_FILTER_MAX_POSTS) return;

  authorFilter.loading = true;
  m.redraw();

  stream
    .loadRange(0, discussion.postIds().length)
    .then((posts: Post[]) => {
      stream.show(posts);
      authorFilter.discussionId = discussion.id()!;
      authorFilter.user = user;
      authorFilter.count = posts.filter((post) => post.contentType() === 'comment' && !post.isHidden() && post.user() === user).length;
      window.scrollTo({ top: 0 });
    })
    .catch(() => {})
    .finally(() => {
      authorFilter.loading = false;
      m.redraw();
    });
}

export function clearAuthorFilter(): void {
  authorFilter.discussionId = null;
  authorFilter.user = null;
  authorFilter.count = 0;
  m.redraw();
}

function activeFor(discussion: Discussion | null | undefined): boolean {
  return !!discussion && !!authorFilter.user && authorFilter.discussionId === discussion.id();
}

export default function installAuthorFilter(): void {
  // Cada post sabe se fica de fora; o retainer precisa redesenhar quando o
  // filtro muda.
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    this.subtree.check(() => (activeFor(this.attrs.post.discussion()) ? authorFilter.user!.id() : ''));
  });

  extend(CommentPost.prototype, 'elementAttrs', function (this: any, attrs: Record<string, unknown>) {
    const post: Post = this.attrs.post;

    if (activeFor(post.discussion()) && post.user() !== authorFilter.user) {
      attrs.className = classList(attrs.className as string, 'CanelaPost--filteredOut');
    }
  });

  extend(DiscussionPage.prototype, 'view', function (this: any, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    const active = activeFor(this.discussion);

    vnode.attrs.className = classList(vnode.attrs.className, { 'CanelaTopic--authorFilter': active });

    if (!active) return;

    const children: any[] = Array.isArray(vnode.children) ? vnode.children : [];
    const streamWrapper = children.find((child) => child && child.attrs && child.attrs.className === 'DiscussionPage-stream');

    if (!streamWrapper || !Array.isArray(streamWrapper.children)) return;

    streamWrapper.children.unshift(
      <div className="CanelaAuthorFilter" role="status">
        <span className="CanelaAuthorFilter-text">
          {t('topic.author_filter.showing', { count: authorFilter.count, username: authorFilter.user!.username() })}
        </span>
        <Button className="Button Button--link CanelaAuthorFilter-clear" onclick={() => clearAuthorFilter()}>
          {t('topic.author_filter.show_all')}
        </Button>
      </div>
    );
  });

  // Outro tópico (ou sair da página) desliga o filtro.
  extend(DiscussionPage.prototype, 'onremove', () => clearAuthorFilter());
}
