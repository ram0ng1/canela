/*
 * A pré-visualização ao lado do editor, como no Discourse: no computador, o
 * texto aparece formatado à direita enquanto se escreve. O botão « no canto
 * do composer (junto de tela cheia e minimizar, como o `toggle-preview` do
 * Discourse) a esconde ou mostra, e a escolha fica no navegador.
 *
 * A prévia é o ComposerPostPreview do core (o mesmo formatador do servidor,
 * em JS), então menções, emoji e markdown saem iguais ao post publicado.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import type ComposerBody from 'flarum/forum/components/ComposerBody';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { composerOn } from './common';
import { t } from '../../utils/settings';
import { richMode } from '../../composer/installToolbar';
import { morphComposer } from '../../composer/morph';

const STORAGE_KEY = 'canela.composerPreview';

let memoryPreference = true;

export function preferred(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    // No modo Markdown a prévia abre por padrão, como no Discourse.
    return value === null ? true : value === '1';
  } catch {
    return memoryPreference;
  }
}

export function setPreferred(value: boolean): void {
  memoryPreference = value;

  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Vale só até sair da página.
  }
}

/**
 * O composer comporta as duas colunas agora: computador, aberto ou em tela
 * cheia. `app.screen()` diz "desktop-hd" a partir de 1200px — comparar só com
 * "desktop" deixava a prévia de fora justo nas telas largas. A altura não
 * conta: o Discourse divide mesmo no composer mais baixo (255px).
 */
export function splitPossible(): boolean {
  const composer = app.composer;
  const screen = app.screen();

  // Só no modo Markdown: no "A" o Discourse não tem a coluna da prévia.
  if (!composerOn('Preview') || richMode() || (screen !== 'desktop' && screen !== 'desktop-hd') || !composer.isVisible()) return false;

  return composer.position === 'normal' || composer.position === 'fullScreen';
}

export function splitPreviewVisible(): boolean {
  return splitPossible() && preferred();
}

/** O nó (no vdom da view) com a classe dada, procurando em profundidade. */
function findByClass(vnode: any, className: string): any {
  if (!vnode || typeof vnode !== 'object') return null;
  if (Array.isArray(vnode)) {
    for (const child of vnode) {
      const found = findByClass(child, className);
      if (found) return found;
    }
    return null;
  }

  const classes = String(vnode.attrs?.className || vnode.attrs?.class || '').split(/\s+/);

  if (classes.includes(className)) return vnode;

  return findByClass(vnode.children, className);
}

/**
 * O ComposerPostPreview do core, buscado na hora de desenhar: ele vem no
 * mesmo pedaço do composer, carregado sob demanda, e um import no topo do
 * arquivo resolveria para `undefined` no boot.
 */
function previewComponent(): any {
  return flarum.reg.get('core', 'forum/components/ComposerPostPreview');
}

export default function installPreview() {
  // O editor vive dentro de `.ComposerBody-editor`; a prévia entra ao lado
  // dele, na mesma caixa. Mexer no vdom pronto evita reescrever a view do
  // ComposerBody (e o que outras extensões põem nela).
  // Pelo nome do módulo: o ComposerBody vem num pedaço carregado sob demanda.
  extend('flarum/forum/components/ComposerBody' as any, 'view', function (this: ComposerBody, vdom: Mithril.Children) {
    if (!splitPreviewVisible()) return;

    const editor = findByClass(vdom, 'ComposerBody-editor');

    if (!editor || !Array.isArray(editor.children)) return;

    editor.attrs.className = `${editor.attrs.className} CanelaComposer-split`;

    // Sem `key`: o TextEditor, irmão dele, não tem, e o Mithril recusa uma
    // lista que mistura nós com e sem chave (o composer quebrava ao abrir a
    // prévia). Entrando sempre por último, a posição do editor não muda.
    editor.children.push(
      <div className="CanelaComposerPreview" aria-label={t('composer.preview.label')}>
        <div className="CanelaComposerPreview-scroll">
          {m(previewComponent(), { className: 'Post-body CanelaComposerPreview-body', composer: app.composer })}
        </div>
      </div>
    );
  });
}

/**
 * O botão « do Discourse (`toggle-preview`): fica no canto do composer, antes
 * de tela cheia e minimizar. A seta gira (pelo CSS) quando a prévia está
 * escondida, como lá.
 */
export function previewToggle(): Mithril.Children {
  const visible = preferred();
  const label = visible ? t('composer.preview.hide') : t('composer.preview.show');

  return (
    <Button
      className={`Button Button--icon Button--link CanelaComposerPreview-toggle${visible ? '' : ' active'}`}
      icon="fas fa-angles-left"
      title={label}
      aria-label={label}
      aria-pressed={visible ? 'true' : 'false'}
      onclick={() => morphComposer(() => setPreferred(!visible))}
    />
  );
}
