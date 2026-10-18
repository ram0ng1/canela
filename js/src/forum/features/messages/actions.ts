/*
 * As ações do tópico de mensagem que dependem do backend do tema: arquivar
 * (e mover de volta para a caixa de entrada) e sair da mensagem.
 */
import app from 'flarum/forum/app';
import extractText from 'flarum/common/utils/extractText';

import { refreshCounts } from './BoxListState';
import { t } from '../../utils/settings';
import { boxHref, isArchived, type Dialog } from './util';

/**
 * "Arquivar" / "Mover para caixa de entrada" (`toggleArchiveMessage`). Como
 * no Discourse, arquivar leva de volta para a caixa de entrada — a mensagem
 * saiu dela —, e mover para a caixa fica na mesma página.
 */
export function toggleArchive(dialog: Dialog): Promise<void> {
  const archive = !isArchived(dialog);

  return dialog
    .save({ canelaArchived: archive })
    .then(() => {
      refreshCounts();
      if (archive && app.session.user) m.route.set(boxHref(app.session.user, 'inbox'));
      m.redraw();
    })
    .catch(() => {});
}

/**
 * Sair da mensagem: o ✕ ao lado do próprio nome no mapa de participantes
 * ("Tem certeza de que quer sair desta mensagem?").
 */
export function leaveDialog(dialog: Dialog): Promise<void> {
  if (!confirm(extractText(t('messages.topic.leave_confirm')))) return Promise.resolve();

  return app
    .request({
      method: 'DELETE',
      url: `${app.forum.attribute('apiUrl')}/dialogs/${dialog.id()}/canela-membership`,
    })
    .then(() => {
      // A conversa some para quem saiu: tira das listas que a mostram.
      const lists = [(app as any).dialogs, (app as any).dropdownDialogs].filter(Boolean);
      lists.forEach((list: any) => typeof list.remove === 'function' && list.remove(dialog));
      app.store.remove(dialog);
      refreshCounts();

      if (app.session.user) m.route.set(boxHref(app.session.user, 'inbox'));
    })
    .catch(() => {});
}
