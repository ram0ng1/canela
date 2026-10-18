/*
 * Peças comuns aos recursos do editor: as chaves do admin e um jeito de
 * estender a barra do editor DEPOIS das outras extensões.
 */
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import type ComposerState from 'flarum/forum/states/ComposerState';
import type EditorDriverInterface from 'flarum/common/utils/EditorDriverInterface';

import { forumBool } from '../../utils/settings';

export type ComposerFeature = 'Emoji' | 'Similar' | 'Hashtags' | 'Drafts' | 'LinkedTopic' | 'Preview';

/**
 * Se um recurso do editor vale agora. Lido a cada uso, e não no install: no
 * initializer o `app.forum` ainda não existe, e o admin pode mudar a opção.
 */
export function composerOn(feature: ComposerFeature): boolean {
  return forumBool('canelaComposerEnabled', true) && forumBool(`canelaComposer${feature}`, true);
}

type ToolbarHook = (this: TextEditor, items: any) => void;

const lateToolbarHooks: ToolbarHook[] = [];
let lateHooksInstalled = false;

/**
 * Estende `TextEditor#toolbarItems` depois de todas as extensões.
 *
 * O flarum/emoji põe um botão `emoji` na barra, e o seletor do tema precisa
 * tomar o lugar dele. A ordem dos initializers das extensões não é garantida,
 * então o gancho só entra no primeiro `oninit` de um editor: a essa altura
 * todos os initializers já rodaram e o nosso fica por último.
 */
export function extendToolbarLate(hook: ToolbarHook): void {
  lateToolbarHooks.push(hook);

  if (lateHooksInstalled) return;
  lateHooksInstalled = true;

  let applied = false;

  extend(TextEditor.prototype, 'oninit', function () {
    if (applied) return;
    applied = true;

    extend(TextEditor.prototype, 'toolbarItems', function (this: TextEditor, items) {
      lateToolbarHooks.forEach((fn) => fn.call(this, items));
    });
  });
}

/**
 * O ComposerState de um TextEditor. O TextEditor do core é JS, e as attrs
 * dele chegam ao TypeScript sem tipo; o cast mora só aqui.
 */
export function editorComposer(editor: TextEditor): ComposerState | null {
  return ((editor.attrs as any)?.composer as ComposerState | undefined) ?? null;
}

/** O driver do editor (o textarea, ou o editor rico de outra extensão). */
export function editorDriver(editor: TextEditor): EditorDriverInterface | null {
  return editorComposer(editor)?.editor ?? null;
}
