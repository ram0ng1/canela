/*
 * O "Compartilhar" do tópico. Fica fora do ShareModal para a janela ir num
 * chunk próprio: no celular (folha do sistema) e com a janela desligada
 * (só copia o link), o modal nem chega a ser baixado.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { copyText } from '../utils/clipboard';

/** Compartilhar o tópico (ou um post dele): janela no computador, folha do sistema no celular. */
export function openShare(discussion: Discussion, post: Post | null = null): void {
  const path = post ? app.route.post(post) : app.route.discussion(discussion);
  const link = (app.forum.attribute<string>('baseOrigin') || window.location.origin) + path;

  if (app.screen() === 'phone' && typeof navigator.share === 'function') {
    navigator.share({ url: link, title: discussion.title() }).catch(() => {});
    return;
  }

  if (!gaps.shareModal()) {
    copyText(link).then((ok) => ok && app.alerts.show({ type: 'success' }, t('gaps.share.copied')));
    return;
  }

  app.modal.show(() => import('./ShareModal'), { discussion, post });
}
