/*
 * Os cliques em links (recurso `links`): o que o tópico traz em
 * `canelaLinks` e o envio de um clique.
 *
 * O envio vai por `navigator.sendBeacon`: o navegador já está saindo para o link, e o beacon é entregue
 * mesmo com a página fechando. O corpo é de formulário (com o csrfToken), o
 * único tipo que o beacon manda sem pré-verificação.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

import { forumBool } from '../../utils/settings';

export interface TopicLink {
  url: string;
  title: string | null;
  domain: string;
  postId: string;
  postNumber: number;
  clicks: number;
}

export interface DiscussionLinks {
  /** Links externos distintos no tópico. */
  total: number;
  /** Os mais clicados primeiro. */
  top: TopicLink[];
  /** id da postagem → endereço → cliques (só os com clique). */
  posts: Record<string, Record<string, number>>;
}

export function linksEnabled(): boolean {
  return forumBool('canelaLinksEnabled', false);
}

export function discussionLinks(discussion: Discussion | null | undefined | false): DiscussionLinks | null {
  if (!discussion || !linksEnabled()) return null;

  const value = discussion.attribute<DiscussionLinks | null | undefined>('canelaLinks');

  if (!value || typeof value !== 'object' || !Array.isArray(value.top)) return null;

  // Sem cliques, o PHP manda o mapa vazio como lista ([]).
  if (!value.posts || Array.isArray(value.posts)) value.posts = {};

  return value;
}

/** Http(s) e para fora do fórum: os únicos que o servidor conta. */
export function isExternalUrl(href: string | null): href is string {
  if (!href) return false;

  try {
    const url = new URL(href, window.location.href);

    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host !== window.location.host;
  } catch {
    return false;
  }
}

/** Cliques já contados nesta página: o número local sobe uma vez só, como no servidor. */
const counted = new Set<string>();

/**
 * Manda o clique e soma 1 no número da página (o servidor descarta o
 * repetido em 24 horas; aqui o mesmo vale enquanto a página não recarrega).
 */
export function trackClick(postId: string, url: string, discussion?: Discussion | null): void {
  if (!linksEnabled()) return;

  const body = new URLSearchParams({ post_id: postId, url, csrfToken: app.session.csrfToken || '' });
  const endpoint = `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}/canela-link-click`;

  try {
    if (!navigator.sendBeacon?.(endpoint, body)) {
      fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
    }
  } catch {
    // Contar o clique nunca pode atrapalhar o link.
  }

  const key = `${postId}|${url}`;
  const links = discussionLinks(discussion);

  if (!links || counted.has(key)) return;

  counted.add(key);

  const post = (links.posts[postId] ||= {});
  post[url] = (post[url] || 0) + 1;

  const item = links.top.find((link) => link.url === url);
  if (item) item.clicks++;
}
