/*
 * Cliques em links, como no Discourse: cada clique num link externo de uma
 * postagem é contado, e o número aparece ao lado do link (`span.badge.clicks`,
 * a partir de 1 clique). Os "Links populares" ficam no mapa do tópico
 * (TopicMap) e os "Melhores links" no resumo do perfil.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import { discussionLinks, isExternalUrl, linksEnabled, trackClick } from './data';
import { t } from '../../utils/settings';
import { formatViews } from '../../utils/views';

export { discussionLinks, linksEnabled, trackClick } from './data';
export type { DiscussionLinks, TopicLink } from './data';

const BADGE = 'CanelaLinkClicks';

export default function installLinks(): void {
  installTracker();
  installBadges();
}

/**
 * Um ouvinte só, no documento: os posts entram e saem da página o tempo todo
 * (a rolagem do PostStream), e um ouvinte por link teria de acompanhar isso.
 * `auxclick` pega o botão do meio (abrir em outra aba), que o Discourse também
 * conta.
 */
function installTracker(): void {
  const onClick = (event: MouseEvent) => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (!linksEnabled()) return;

    const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const body = anchor?.closest('.Post-body');
    const href = anchor?.getAttribute('href') ?? null;

    if (!anchor || !body || anchor.closest(`.${BADGE}`) || !isExternalUrl(href)) return;

    const item = body.closest('.PostStream-item[data-id], .PostList [data-id]') as HTMLElement | null;
    const postId = item?.dataset.id;

    if (!postId) return;

    const post = app.store.getById<Post>('posts', postId);

    trackClick(postId, href, (post?.discussion() as Discussion | undefined) || null);

    // O post não redesenha por causa disso (o Post do core só se refaz quando
    // ele muda): o número novo entra direto no DOM, como no Discourse.
    if (post) decorateBody(body as HTMLElement, post);
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);
}

/**
 * O número fica DENTRO do elemento que já tem o link (o <p>, o <li>), logo
 * depois do <a>: o post entra com m.trust, e um nó novo no nível de cima
 * atrapalharia o Mithril a remover esse HTML quando o post muda.
 */
function installBadges(): void {
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body') as HTMLElement | null;
    const post = this.attrs?.post as Post | undefined;

    if (body && post) decorateBody(body, post);
  });
}

/** Põe, atualiza ou tira o número ao lado de cada link do post. */
export function decorateBody(body: HTMLElement, post: Post): void {
  const counts = discussionLinks(post.discussion() as Discussion)?.posts[String(post.id())];

  if (!counts && !body.querySelector(`.${BADGE}`)) return;

  body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    if (anchor.parentElement === body || anchor.closest(`.${BADGE}`)) return;

    const href = anchor.getAttribute('href') || '';
    const clicks = counts?.[href] || 0;
    const next = anchor.nextElementSibling as HTMLElement | null;
    const badge = next?.classList.contains(BADGE) ? next : null;

    if (clicks < 1) {
      badge?.remove();
      return;
    }

    const label = t('links.clicks', { count: clicks });
    // O `number` do Discourse: 1,2 mil, 120 mil.
    const text = formatViews(clicks);

    if (badge) {
      if (badge.textContent !== text) badge.textContent = text;
      badge.title = label;
      return;
    }

    const span = document.createElement('span');
    span.className = `badge clicks ${BADGE}`;
    span.title = label;
    span.setAttribute('aria-label', label);
    span.textContent = text;
    anchor.after(span);
  });
}
