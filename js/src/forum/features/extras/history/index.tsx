/*
 * Histórico de edições: o "Editado" do cabeçalho da postagem (PostEdited do
 * core) vira o lápis com o número de revisões, que abre o modal
 * comparando as versões.
 *
 * Postagens editadas antes de o histórico existir (ou com o recurso
 * desligado) não têm revisões guardadas e continuam com o "Editado" do core.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import PostEdited from 'flarum/forum/components/PostEdited';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { forumBool, t } from '../../../utils/settings';

export function revisionCount(post: Post): number {
  const count = Number(post.attribute<number>('canelaRevisionCount'));

  return Number.isFinite(count) && count > 0 ? count : 0;
}

export default function installPostHistory(): void {
  override(PostEdited.prototype, 'view', function (this: PostEdited, original: () => Mithril.Children) {
    const post: Post = (this as any).attrs.post;
    const count = revisionCount(post);

    if (!forumBool('canelaPostHistoryEnabled', true) || !count) return original();

    const editedUser = post.editedUser();
    const editedAt = post.editedAt();
    const info = extractText(app.translator.trans('core.forum.post.edited_tooltip', { user: editedUser, ago: editedAt ? humanTime(editedAt) : '' }));
    const label = `${t('extras.history.open', { count })}: ${info}`;

    return (
      // Sem `showOnFocus`: ao fechar o modal o foco volta ao botão e o
      // tooltip reapareceria sem o cursor em cima.
      <Tooltip text={info} showOnFocus={false}>
        <button
          type="button"
          className="Button--ua-reset PostEdited CanelaPostEdited"
          aria-label={label}
          onclick={(event: MouseEvent) => {
            // O modal cobre o botão e o `mouseleave` não chega: o tooltip
            // abriria (ou ficaria aberto) por cima do histórico. O `leave` do
            // tooltip também cancela o que ainda esperava o atraso para abrir.
            $(event.currentTarget as HTMLElement).trigger('mouseleave');
            app.modal.show(() => import('./HistoryModal'), { post });
          }}
        >
          <Icon name="fas fa-pencil" />
          <span className="CanelaPostEdited-count">{count}</span>
        </button>
      </Tooltip>
    );
  });
}
