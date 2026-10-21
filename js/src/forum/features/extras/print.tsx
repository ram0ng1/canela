/*
 * "Imprimir" tópico: um item nos controles
 * da discussão que carrega TODAS as postagens (a página do tópico só tem as
 * que já rolaram para a tela), monta uma visão limpa — título, autor, data e
 * texto de cada postagem — e chama a impressão do navegador.
 *
 * A visão é uma camada sobre a página, e o `@media print` do tema esconde o
 * resto (casca, barra lateral, linha do tempo, editor). Ao terminar a
 * impressão a camada some e a página fica como estava.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Avatar from 'flarum/common/components/Avatar';
import username from 'flarum/common/helpers/username';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';
import { fullDate } from '../../utils/dates';
import { discussionBadges } from '../../utils/tags';

/** O máximo que a API entrega por página. */
const PAGE_LIMIT = 50;

const PRINTING_CLASS = 'canela-printing';

async function loadAllPosts(discussion: Discussion): Promise<Post[]> {
  const posts: Post[] = [];
  let offset = 0;

  for (;;) {
    const page: any = await app.store.find<Post[]>('posts', {
      filter: { discussion: discussion.id(), type: 'comment' },
      sort: 'number',
      include: 'user',
      page: { offset, limit: PAGE_LIMIT },
    });

    posts.push(...page);
    offset += page.length;

    if (!page.length || !page.payload?.links?.next) break;
  }

  return posts;
}

function printView(discussion: Discussion, posts: Post[], close: () => void): Mithril.Children {
  return (
    <div className="CanelaPrint">
      <div className="CanelaPrint-toolbar">
        <Button className="Button Button--primary" icon="fas fa-print" onclick={() => window.print()}>
          {t('extras.print.print_again')}
        </Button>
        <Button className="Button" icon="fas fa-times" onclick={close}>
          {t('extras.print.close')}
        </Button>
      </div>
      <header className="CanelaPrint-header">
        <h1 className="CanelaPrint-title">{discussion.title()}</h1>
        <div className="CanelaPrint-meta">
          {discussionBadges(discussion, false)}
          <span className="CanelaPrint-url">{window.location.origin + app.route.discussion(discussion)}</span>
        </div>
      </header>
      {posts.map((post) => (
        <article className="CanelaPrint-post">
          <div className="CanelaPrint-postHeader">
            <Avatar user={post.user() || null} title="" />
            <strong className="CanelaPrint-author">{username(post.user())}</strong>
            <span className="CanelaPrint-date">{fullDate(post.createdAt())}</span>
            <span className="CanelaPrint-number">#{post.number()}</span>
          </div>
          <div className="CanelaPrint-body Post-body">{m.trust(post.contentHtml() || '')}</div>
        </article>
      ))}
    </div>
  );
}

export async function printDiscussion(discussion: Discussion): Promise<void> {
  const loading = app.alerts.show({ type: 'success' }, t('extras.print.preparing'));
  let posts: Post[];

  try {
    posts = await loadAllPosts(discussion);
  } finally {
    app.alerts.dismiss(loading);
  }

  const root = document.createElement('div');
  root.id = 'canela-print';
  document.body.appendChild(root);

  const close = () => {
    window.removeEventListener('afterprint', close);
    document.documentElement.classList.remove(PRINTING_CLASS);
    m.render(root, null);
    root.remove();
  };

  document.documentElement.classList.add(PRINTING_CLASS);
  m.render(root, printView(discussion, posts, close));

  // As imagens das postagens precisam terminar de carregar, senão saem em
  // branco no papel. Espera por elas (com um teto, para uma quebrada não
  // travar a impressão).
  const images = Array.from(root.querySelectorAll('img')).filter((image) => !image.complete);
  const settled = (image: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });

  await Promise.race([Promise.all(images.map(settled)), new Promise((resolve) => setTimeout(resolve, 3000))]);

  window.addEventListener('afterprint', close);
  window.print();
}

export default function installPrint(): void {
  extend(DiscussionControls, 'userControls', function (items: ItemList<Mithril.Children>, discussion: Discussion) {
    if (!forumBool('canelaPrintTopicEnabled', true)) return;

    items.add(
      'canelaPrint',
      <Button icon="fas fa-print" onclick={() => printDiscussion(discussion).catch(() => {})}>
        {t('extras.print.button')}
      </Button>,
      -10
    );
  });
}
