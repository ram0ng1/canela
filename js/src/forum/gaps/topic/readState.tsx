/*
 * O que o Discourse mostra sobre a leitura dentro do tópico:
 *
 * - o pontinho azul de "postagem não lida" no canto do cabeçalho do post
 *   (.read-state), que some devagar quando o post é lido;
 * - a linha vermelha "último acesso" (.topic-post-visited) logo depois do
 *   último post que o leitor tinha lido na visita anterior.
 *
 * As duas dependem de onde o leitor parou QUANDO abriu o tópico; o core vai
 * avançando o lastReadPostNumber enquanto se lê, então o valor de entrada é
 * guardado à parte, por tópico, no momento em que a página o mostra.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

/** Último post lido quando o tópico foi aberto, por id do tópico. */
const visitedAtOpen = new Map<string, number>();

export function visitedNumber(discussion: Discussion | null | undefined): number | null {
  if (!discussion || !app.session.user) return null;

  const value = visitedAtOpen.get(String(discussion.id()));

  return value === undefined ? null : value;
}

function readState(post: Post): 'unread' | 'read' | null {
  const discussion = post.discussion();
  const visited = visitedNumber(discussion || null);

  if (visited === null || !discussion || post.number() <= visited) return null;

  return (discussion.lastReadPostNumber() || 0) >= post.number() ? 'read' : 'unread';
}

/** Os filhos de um vnode como lista, para acrescentar mais um. */
function childrenOf(vnode: any): any[] {
  if (Array.isArray(vnode.children)) return vnode.children;

  vnode.children = vnode.children == null ? [] : [vnode.children];

  return vnode.children;
}

export default function installReadState(): void {
  extend(DiscussionPage.prototype, 'show', function (this: any, _result: unknown, discussion: Discussion) {
    if (!discussion || this.canelaVisitedFor === discussion.id()) return;

    this.canelaVisitedFor = discussion.id();

    // Um tópico nunca aberto conta como "lido até 0": tudo nele é novo, mas
    // aí a linha "último acesso" não faz sentido (não houve acesso).
    visitedAtOpen.set(String(discussion.id()), discussion.lastReadPostNumber() || 0);
  });

  // O pontinho muda sem o post mudar: o retainer do post precisa saber.
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    this.subtree?.check(() => (gaps.readState() ? readState(this.attrs.post) : null));
  });

  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!gaps.readState()) return;

    const state = readState(this.attrs.post);

    if (!state) return;

    items.add(
      'canelaReadState',
      <span
        className={classList('CanelaReadState', { 'CanelaReadState--read': state === 'read' })}
        title={t('gaps.read_state.unread')}
        aria-hidden="true"
      >
        <Icon name="fas fa-circle" />
      </span>,
      -100
    );
  });

  // A linha "último acesso" entra dentro do item do post lido por último:
  // os itens do stream têm key, e um irmão novo no meio deles teria de ter
  // key também — dentro do item, os filhos não têm.
  extend('flarum/forum/components/PostStream', 'view', function (this: any, vdom: any) {
    if (!gaps.readState() || !vdom || !Array.isArray(vdom.children)) return;

    const discussion: Discussion | undefined = this.discussion;
    const visited = visitedNumber(discussion);
    const last = discussion?.lastPostNumber() || 0;

    if (!visited || visited >= last) return;

    const items: any[] = vdom.children;

    items.forEach((child: any, index: number) => {
      // O primeiro post vem num fragmento junto do mapa do tópico.
      const item = child && child.tag === '[' && Array.isArray(child.children) ? child.children[0] : child;

      if (!item || !item.attrs || Number(item.attrs['data-number']) !== visited) return;

      // No último post desenhado a linha não diz nada (não há o que vem depois).
      const isLastShown = !items.slice(index + 1).some((next: any) => next && next.attrs && next.attrs['data-number']);

      if (isLastShown) return;

      childrenOf(item).push(
        <div className="CanelaVisitedLine" role="separator">
          <span className="CanelaVisitedLine-message" role="heading" aria-level="2">
            {t('gaps.read_state.last_visit')}
          </span>
        </div>
      );
    });
  });
}
