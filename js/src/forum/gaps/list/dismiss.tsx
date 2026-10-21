/*
 * O "Descartar" das listas Não lidos e Novos: em cima, à direita, e de novo no fim da lista.
 * Marca como lidos os tópicos da lista — e, na lista geral de não lidos, tudo,
 * com o "marcar tudo como lido" do core, numa requisição só.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { refreshCounts } from '../../features/stats/counts';

let busy = false;

function currentSort(): string {
  return String(app.search.state.params().sort || '');
}

function loaded(): Discussion[] {
  return app.discussions.getPages().flatMap((page: any) => page.items as Discussion[]);
}

function unreadLoaded(): Discussion[] {
  return loaded().filter((discussion) => discussion.isUnread());
}

/** Em que listas o botão aparece: Não lidos sempre; Novos, se houver o que descartar. */
function shouldShow(): boolean {
  if (!gaps.dismiss() || !app.session.user || app.discussions.isEmpty() || app.discussions.isInitialLoading()) return false;

  const sort = currentSort();

  if (sort === 'unread') return true;

  return sort === 'newest' && unreadLoaded().length > 0;
}

async function dismiss(): Promise<void> {
  if (busy) return;

  const sort = currentSort();
  const params = app.search.state.params() as Record<string, any>;
  const filtered = !!params.tags || !!params.q;

  if (!window.confirm(sort === 'unread' ? t('gaps.dismiss.confirm_unread') : t('gaps.dismiss.confirm_new'))) return;

  busy = true;
  m.redraw();

  try {
    if (sort === 'unread' && !filtered) {
      // A lista geral de não lidos é "tudo": o mesmo do botão do core.
      await app.session.user!.save({ markedAllAsReadAt: new Date() });
    } else {
      // Numa categoria (ou em Novos) só os tópicos da lista.
      await Promise.all(unreadLoaded().map((discussion) => discussion.save({ lastReadPostNumber: discussion.lastPostNumber() }).catch(() => null)));
    }

    app.discussions.refresh();
    refreshCounts(true).catch(() => {});
  } finally {
    busy = false;
    m.redraw();
  }
}

function dismissButton(position: 'top' | 'bottom'): Mithril.Children {
  const label = currentSort() === 'unread' ? t('gaps.dismiss.unread') : t('gaps.dismiss.new');

  return (
    <div className={`CanelaDismiss CanelaDismiss--${position}`}>
      <Button className="Button CanelaDismiss-button" icon="fas fa-check" loading={busy} onclick={() => dismiss()}>
        {label}
      </Button>
    </div>
  );
}

export default function installDismiss(): void {
  extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
    if (!shouldShow()) return;

    // Entre a barra de ferramentas (100) e a lista (90); e depois da lista.
    items.add('canelaDismissTop', dismissButton('top'), 95);

    if (!app.discussions.hasNext()) items.add('canelaDismissBottom', dismissButton('bottom'), 80);
  });
}
