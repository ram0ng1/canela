/*
 * Rascunhos guardados pelo fof/drafts.
 *
 * - O composer de tópico novo e o de resposta salvam sozinhos dois segundos
 *   depois que a pessoa para de escrever (o autosave do fof é opcional e vem
 *   desligado; quem o ligou nas preferências fica com o dele).
 * - Responder num tópico que tem rascunho retoma o rascunho.
 * - Fechar com texto pergunta descartar / guardar / continuar; trocar de
 *   composer guarda sem perguntar.
 * - Sem botão de salvar (o disquete do fof sai dos controles): o rodapé do
 *   editor diz discretamente "Salvando…" / "Rascunho salvo", e avisa se falhar.
 * - A lista fica no "⌄" do botão "Iniciar Discussão", no menu do usuário e na aba
 *   "Rascunhos" do perfil.
 *
 * Tudo depende de `draftsOn()`: sem o fof-drafts habilitado, nada aparece.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import ComposerState from 'flarum/forum/states/ComposerState';
import TextEditor from 'flarum/common/components/TextEditor';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import Icon from 'flarum/common/components/Icon';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import DraftsUserPage from './DraftsUserPage';
import {
  allDrafts,
  discardCurrentDraft,
  draftChanged,
  draftCount,
  draftableBody,
  draftStatus,
  draftsLoaded,
  draftsOn,
  hasContent,
  loadDrafts,
  replyDraftDiscussionId,
  saveCurrentDraft,
} from './fofDrafts';
import { editorComposer } from '../common';
import { t } from '../../../utils/settings';

const SAVE_DELAY = 2000;
const TICK = 500;

/** Quem ligou o autosave do fof nas preferências fica com o dele (sem salvar em dobro). */
function fofAutosave(): boolean {
  return !!(app.session.user as any)?.preferences?.()?.draftAutosaveEnable;
}

/**
 * Salva sozinho: a cada meio segundo compara o que está no composer; dois
 * segundos sem mudança e com algo novo, grava. Enviando (o fof apaga o
 * rascunho ao publicar), não grava.
 */
function startAutosave(body: any): () => void {
  let lastSeen = '';
  let dueAt = 0;
  let saving = false;
  const composerBody = app.composer.body;

  const timer = setInterval(() => {
    if (app.composer.body !== composerBody || body.loading || !draftsOn() || fofAutosave()) {
      dueAt = 0;
      return;
    }

    const fields: any = app.composer.fields || {};
    const seen = JSON.stringify([fields.content?.() || '', fields.title?.() || '', (fields.tags || []).map((tag: any) => tag?.id?.())]);

    if (seen !== lastSeen) {
      lastSeen = seen;
      dueAt = Date.now() + SAVE_DELAY;
      return;
    }

    if (dueAt && Date.now() >= dueAt && !saving && draftChanged()) {
      dueAt = 0;
      saving = true;
      saveCurrentDraft().finally(() => (saving = false));
    }
  }, TICK);

  return () => clearInterval(timer);
}

/**
 * Resposta aberta sem rascunho escolhido: se a pessoa tem um rascunho desse
 * tópico, o composer o retoma. Uma citação inserida
 * ao abrir não é sobrescrita.
 */
function restoreReplyDraft(body: any): void {
  const discussion = body.attrs?.discussion;
  const composer: any = app.composer;
  const composerBody = composer.body;

  if (!discussion || body.attrs?.draft || !composer.bodyMatches('flarum/forum/components/ReplyComposer')) return;

  const run = (editorBuilt: boolean) => {
    if (composer.body !== composerBody || composer.draft) return;

    const draft = allDrafts().find((item) => item.type() === 'reply' && replyDraftDiscussionId(item) === String(discussion.id()));

    if (!draft || (composer.fields.content() || '').trim()) return;

    const content = draft.content() || '';

    composer.draft = draft;

    if (editorBuilt && composer.editor) composer.editor.insertBetween(0, composer.fields.content().length, content, false);
    else composer.fields.content(content);

    m.redraw();
  };

  if (draftsLoaded()) run(false);
  else if (draftCount() > 0)
    loadDrafts()
      .then(() => composer.editorReady())
      .then(() => run(true));
}

function confirmClose(composer: ComposerState): void {
  app.modal.show(() => import('./DraftCloseModal'), {
    ondiscard: () => {
      discardCurrentDraft();
      composer.hide();
    },
    onsave: () => {
      saveCurrentDraft();
      composer.hide();
    },
  });
}

export default function installDrafts() {
  // A rota existe sempre (o initializer roda antes de o fórum carregar as
  // opções); sem rascunhos a página manda para as postagens.
  app.routes['user.drafts'] = {
    path: '/u/:username/drafts',
    component: DraftsUserPage,
    resolverClass: UserPageResolver,
  } as any;

  // Pelo nome do módulo: o ComposerBody vem num pedaço carregado sob demanda.
  extend('flarum/forum/components/ComposerBody' as any, 'oninit', function (this: any) {
    if (!draftsOn() || !draftableBody()) return;

    (app.composer as any).canelaDraftError = false;
    this.canelaStopAutosave = startAutosave(this);
    restoreReplyDraft(this);
  });

  extend('flarum/forum/components/ComposerBody' as any, 'onremove', function (this: any) {
    this.canelaStopAutosave?.();
  });

  // Trocar de composer (abrir outra resposta, um tópico novo) não pergunta
  // nada: o texto fica guardado como rascunho.
  override(ComposerState.prototype, 'preventExit', function (this: ComposerState, original: () => boolean | void) {
    if (this.isVisible() && draftsOn() && hasContent()) {
      saveCurrentDraft();
      return false;
    }

    return original();
  });

  override(ComposerState.prototype, 'close', function (this: ComposerState, original: () => void) {
    if (!draftsOn() || !this.isVisible() || !draftableBody()) return original();

    if (hasContent()) {
      confirmClose(this);
      return;
    }

    // Apagou todo o texto: o rascunho deixa de existir.
    discardCurrentDraft();
    this.hide();
  });

  // O fof põe um disquete ("salvar rascunho") nos controles do composer. Aqui
  // não há botão: salva sozinho. O initializer do fof roda depois
  // do tema, então a remoção é registrada no `mount`, depois do dele.
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    extend('flarum/forum/components/Composer' as any, 'controlItems', function (items: ItemList<Mithril.Children>) {
      if (items.has('save-draft')) items.remove('save-draft');
    });

    return original(...args);
  });

  // Rodapé do editor: o estado do rascunho, discreto — "Salvando…",
  // "Rascunho salvo" por alguns segundos, ou o erro.
  extend(TextEditor.prototype, 'controlItems', function (this: TextEditor, items: ItemList<Mithril.Children>) {
    const status = draftStatus();

    if (!draftsOn() || editorComposer(this) !== app.composer || !draftableBody() || !status) return;

    const label = t(`composer.drafts.status_${status}`);
    const icon = status === 'error' ? 'fas fa-triangle-exclamation' : status === 'saved' ? 'fas fa-check' : null;

    items.add(
      'canelaDraft',
      <span className={`CanelaDraftStatus CanelaDraftStatus--${status}`} role={status === 'error' ? 'alert' : 'status'} title={label}>
        {icon && <Icon name={icon} />}
        <span className="CanelaDraftStatus-label">{label}</span>
      </span>,
      -100
    );
  });

  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user || !draftsOn()) return;

    const count = draftCount();

    items.add(
      'canelaDrafts',
      <LinkButton icon="fas fa-pen-ruler" href={app.route('user.drafts', { username: user.slug() })}>
        {t('composer.drafts.nav')}
        {count > 0 && <span className="CanelaDrafts-count">{count}</span>}
      </LinkButton>,
      // Logo depois de "Perfil" (100) e antes de "Configurações" (50).
      90
    );
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || this.user !== app.session.user || !draftsOn()) return;

    const count = draftCount();

    items.add(
      'canelaDrafts',
      <LinkButton href={app.route('user.drafts', { username: this.user.slug() })} icon="fas fa-pen-ruler">
        {t('composer.drafts.nav')}
        {/* "Rascunhos (2)", com a contagem. */}
        {count > 0 && ` (${count})`}
      </LinkButton>,
      // Depois de Postagens (100) e Tópicos (90), antes das abas de outras extensões.
      70
    );
  });
}
