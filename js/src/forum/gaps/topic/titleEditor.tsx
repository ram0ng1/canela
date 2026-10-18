/*
 * Editar o título no próprio cabeçalho do tópico, como o Discourse: o lápis
 * ao lado do título (para quem pode renomear) troca o título por um campo,
 * com o botão das categorias/etiquetas ao lado e "✓"/"✕" para salvar ou
 * desistir. Enter salva, Esc desiste.
 *
 * O core só renomeia por uma janela (RenameDiscussionModal) e muda as tags
 * por outra; aqui o campo é do tema, e as tags continuam na janela do
 * flarum/tags, aberta pelo mesmo item que o menu do tópico usa.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

interface EditState {
  id: string;
  title: string;
  saving: boolean;
}

let editing: EditState | null = null;

/** O item "Editar etiquetas" que o flarum/tags põe nos controles de moderação. */
function tagsControl(discussion: Discussion): any {
  const controls = DiscussionControls.moderationControls(discussion);

  return controls.has('tags') ? controls.get('tags') : null;
}

function start(discussion: Discussion): void {
  // O título cru do modelo: title() pode devolver a tradução automática (features/ai/translation).
  editing = { id: String(discussion.id()), title: discussion.attribute<string>('title'), saving: false };
  m.redraw();
}

function cancel(): void {
  editing = null;
  m.redraw();
}

function save(discussion: Discussion): void {
  if (!editing || editing.saving) return;

  const title = editing.title.trim();

  // Título vazio ou igual: nada a salvar, só fecha.
  if (!title || title === discussion.attribute<string>('title')) {
    cancel();
    return;
  }

  editing.saving = true;

  discussion
    .save({ title })
    .then(() => {
      editing = null;

      // O post de evento "renomeou o tópico" entra no stream, como no modal do core.
      const stream = app.current.get('stream');
      if (stream && typeof stream.update === 'function') stream.update();
    })
    .catch(() => {
      if (editing) editing.saving = false;
    })
    .finally(() => m.redraw());
}

function editorView(discussion: Discussion): Mithril.Children {
  const state = editing!;
  const tags = tagsControl(discussion);

  return (
    <form
      className="CanelaTitleEditor"
      onsubmit={(event: SubmitEvent) => {
        event.preventDefault();
        save(discussion);
      }}
    >
      <input
        className="FormControl CanelaTitleEditor-input"
        value={state.title}
        disabled={state.saving}
        aria-label={t('gaps.title_editor.label')}
        oninput={(event: InputEvent) => (state.title = (event.target as HTMLInputElement).value)}
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        oncreate={(vnode: Mithril.VnodeDOM) => {
          const input = vnode.dom as HTMLInputElement;
          input.focus();
          input.select();
        }}
      />
      <div className="CanelaTitleEditor-actions">
        {tags && (
          <Button
            className="Button CanelaTitleEditor-tags"
            icon="fas fa-tag"
            type="button"
            disabled={state.saving}
            onclick={() => tags.attrs?.onclick?.()}
          >
            {t('gaps.title_editor.tags')}
          </Button>
        )}
        <Button
          className="Button Button--primary Button--icon CanelaTitleEditor-save"
          icon="fas fa-check"
          type="submit"
          loading={state.saving}
          aria-label={t('gaps.title_editor.save')}
          title={t('gaps.title_editor.save')}
        />
        <Button
          className="Button Button--icon CanelaTitleEditor-cancel"
          icon="fas fa-xmark"
          type="button"
          disabled={state.saving}
          aria-label={t('gaps.title_editor.cancel')}
          title={t('gaps.title_editor.cancel')}
          onclick={cancel}
        />
      </div>
    </form>
  );
}

export default function installTitleEditor(): void {
  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    const discussion = this.attrs.discussion;

    if (!gaps.titleEditor() || !discussion || !items.has('title')) return;

    // Outro tópico aberto enquanto se editava: a edição antiga não vale aqui.
    if (editing && editing.id !== String(discussion.id())) editing = null;

    if (editing) {
      items.setContent('title', editorView(discussion));

      // Enquanto se edita, a linha de categoria e etiquetas dá lugar ao botão
      // delas, como no Discourse.
      if (items.has('canelaBadges')) items.remove('canelaBadges');

      return;
    }

    if (!discussion.canRename()) return;

    const title = items.get('title') as any;

    items.setContent(
      'title',
      <div className="CanelaTitleEditor-display">
        {title}
        <Button
          className="Button Button--icon Button--link CanelaTitleEditor-edit"
          icon="fas fa-pencil"
          aria-label={t('gaps.title_editor.edit')}
          title={t('gaps.title_editor.edit')}
          onclick={() => start(discussion)}
        />
      </div>
    );
  });
}
