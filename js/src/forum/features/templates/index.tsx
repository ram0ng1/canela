/*
 * Modelos do editor no composer de tópico novo (extend/templates.php):
 *
 * - o modelo das tags escolhidas entra sozinho (o obrigatório, ou o primeiro
 *   da ordem do admin) enquanto o composer está em branco: o texto (modelo
 *   editável) ou os campos no lugar da área de texto (modelo "sem texto
 *   livre");
 * - com vários modelos na tag, a troca fica no menu ⊕ da barra do editor
 *   (uma ação por modelo, mais "Texto livre" quando nenhum é obrigatório):
 *   nada a mais no corpo do composer;
 * - no formulário só os campos são preenchidos: o texto final (o modelo com
 *   os campos trocados) vai para o conteúdo do composer, e a prévia e os
 *   rascunhos o veem como texto comum. Publicar com um campo obrigatório em
 *   branco é barrado. O que a pessoa tinha escrito antes do formulário volta
 *   ao sair dele.
 *
 * Tudo acontece no DiscussionComposer; responder e editar não mudam.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import TemplatePanel from './TemplatePanel';
import { candidatesFor, loadTemplate, newState, templatesOn, type TemplateState } from './model';
import { missingRequired, render, type TemplateSummary } from '../../../common/templates';
import { findByClass } from '../composer/installPreview';
import { addMoreAction, type KeyedAction } from '../../composer/installToolbar';
import { t } from '../../utils/settings';

const DISCUSSION = 'flarum/forum/components/DiscussionComposer';

/** O DiscussionComposer aberto agora (as ações do menu ⊕ falam com ele). */
let current: any = null;

function stateOf(body: any): TemplateState | null {
  return (body?.canelaTemplates as TemplateState | undefined) ?? null;
}

function content(body: any): string {
  return (body.composer.fields.content() as string | undefined) || '';
}

/**
 * Escreve o texto no composer. A área de texto (textarea) é atualizada
 * direto, sem passar pelo editor, que levaria o foco para ela a cada tecla
 * do formulário. Outro editor (rico) só recebe o texto quando `syncEditor`
 * pede: ao sair do formulário, ou num modelo de texto.
 */
function setContent(body: any, text: string, syncEditor: boolean): void {
  const previous = content(body);
  const editor: any = body.composer.editor;

  body.composer.fields.content(text);

  if (editor?.el instanceof HTMLTextAreaElement) {
    if (editor.el.value !== text) editor.el.value = text;
  } else if (syncEditor && editor && typeof editor.insertBetween === 'function') {
    editor.insertBetween(0, previous.length, text);
  }
}

/** O conteúdo é o que o recurso pôs (ou nada): dá para trocar sem perguntar. */
function untouched(body: any, state: TemplateState): boolean {
  const current = content(body);

  return !current.trim() || current === state.applied;
}

function apply(body: any, state: TemplateState): void {
  const template = state.template;

  if (!template) return;

  const text = template.kind === 'form' ? render(template.body, state.values) : template.body;

  state.applied = text;
  setContent(body, text, template.kind === 'text');
}

function reset(state: TemplateState): void {
  state.selected = null;
  state.template = null;
  state.values = {};
  state.invalid = new Set();
  state.applied = null;
  state.backup = null;
  state.loading = false;
  state.request++;
}

/** Volta ao texto livre. */
function deselect(body: any, state: TemplateState): void {
  let next: string | null = null;

  if (state.template?.kind === 'form') {
    if (state.backup !== null) next = state.backup;
    // Formulário em branco: nada fica. Preenchido, o texto montado fica, para ser editado.
    else if (!Object.values(state.values).some((value) => value.trim())) next = '';
  } else if (state.selected && content(body) === state.applied) {
    next = state.backup ?? '';
  }

  reset(state);

  if (next !== null) setContent(body, next, true);
}

/** Escolhe um modelo: `interactive` quando foi a pessoa (pode perguntar antes de trocar o texto). */
function select(body: any, state: TemplateState, summary: TemplateSummary, interactive: boolean): void {
  if (state.selected?.id === summary.id) return;

  const text = content(body);
  const owned = text === state.applied;

  // Um modelo de texto substitui o que está escrito: só com confirmação.
  if (summary.kind === 'text' && !untouched(body, state) && (!interactive || !confirm(t('templates.replace_confirm')))) return;

  // O que a pessoa tinha escrito antes do primeiro formulário fica guardado e
  // volta ao sair dele; trocar de modelo mantém a reserva.
  if (summary.kind === 'form' && !owned && text.trim() && state.backup === null) state.backup = text;

  state.selected = summary;
  state.template = null;
  state.values = {};
  state.invalid = new Set();
  state.loading = true;

  const token = ++state.request;

  loadTemplate(summary.id).then(
    (template) => {
      if (state.request !== token) return;

      state.loading = false;
      state.template = template;
      apply(body, state);
      m.redraw();
    },
    () => {
      if (state.request !== token) return;

      state.loading = false;
      state.selected = null;
      app.alerts.show({ type: 'error' }, t('templates.load_failed'));
      m.redraw();
    }
  );
}

/**
 * A cada redesenho: as tags mudaram? Então os modelos que valem mudam, o
 * escolhido pode deixar de valer, e um modelo entra sozinho (o obrigatório,
 * ou o primeiro da ordem) enquanto o composer está em branco.
 */
function sync(body: any): void {
  const state = stateOf(body);

  if (!state || !templatesOn()) return;

  const tags: any[] = body.composer.fields.tags || [];
  const ids = tags.map((tag) => String(tag?.id?.() ?? '')).filter(Boolean);
  const key = [...ids].sort().join(',');

  if (key === state.tagKey) return;

  state.tagKey = key;
  state.candidates = candidatesFor(ids);

  if (state.selected && !state.candidates.some((template) => template.id === state.selected!.id)) deselect(body, state);

  if (!state.selected && untouched(body, state)) {
    const pick = state.candidates.find((template) => template.required) ?? state.candidates[0];

    if (pick) select(body, state, pick, false);
  }
}

function choose(body: any, id: number | null): void {
  const state = stateOf(body);

  if (!state) return;

  if (id === null) {
    if (state.selected) deselect(body, state);
    return;
  }

  const summary = state.candidates.find((template) => template.id === id);

  if (summary) select(body, state, summary, true);
}

function input(body: any, key: string, value: string): void {
  const state = stateOf(body);

  if (!state?.template) return;

  state.values[key] = value;
  state.invalid.delete(key);
  apply(body, state);
}

function focusField(key: string): void {
  const field = document.querySelector<HTMLElement>(`.CanelaTemplateField[data-key="${CSS.escape(key)}"] .FormControl`);

  field?.focus();
}

/** As ações do menu ⊕: um item por modelo da tag e, sem modelo obrigatório, "Texto livre". */
function menuActions(): KeyedAction[] | null {
  const body = current;
  const state = body ? stateOf(body) : null;

  if (!state || !templatesOn() || !app.composer.isVisible() || !app.composer.bodyMatches(DISCUSSION as any) || !state.candidates.length) {
    return null;
  }

  const actions: KeyedAction[] = state.candidates.map((template) => ({
    key: `canelaTemplate-${template.id}`,
    icon: template.kind === 'form' ? 'fas fa-list-check' : 'fas fa-align-left',
    label: template.name,
    active: state.selected?.id === template.id,
    onclick: () => choose(body, template.id),
  }));

  if (!state.candidates.some((template) => template.required)) {
    actions.push({
      key: 'canelaTemplateFree',
      icon: 'fas fa-pen',
      label: t('templates.free_text'),
      active: !state.selected,
      onclick: () => choose(body, null),
    });
  }

  return actions;
}

export default function installTemplates(): void {
  extend(DISCUSSION as any, 'oninit', function (this: any) {
    this.canelaTemplates = newState();
    current = this;
  });

  extend(DISCUSSION as any, 'onremove', function (this: any) {
    if (current === this) current = null;
  });

  // O headerItems roda a cada redesenho: é onde a troca de tags é percebida.
  extend(DISCUSSION as any, 'headerItems', function (this: any) {
    sync(this);
  });

  addMoreAction(menuActions);

  // No formulário, os campos entram na frente da área do editor (que some
  // pelo CSS). Sempre um nó ali (nulo fora do formulário): se o TextEditor
  // mudasse de posição na lista, o Mithril o recriaria, e o texto digitado se
  // perderia.
  extend('flarum/forum/components/ComposerBody' as any, 'view', function (this: any, vdom: Mithril.Children) {
    const state = stateOf(this);

    if (!state || !templatesOn()) return;

    const editor = findByClass(vdom, 'ComposerBody-editor');

    if (!editor || !Array.isArray(editor.children)) return;

    const form = state.template?.kind === 'form' ? state.template : null;

    editor.attrs.className = classList(editor.attrs.className, { 'CanelaComposer-form': !!form });

    editor.children.unshift(
      form ? (
        <TemplatePanel
          state={state}
          template={form}
          disabled={!!this.loading || !!this.attrs.disabled}
          oninput={(key: string, value: string) => input(this, key, value)}
        />
      ) : null
    );
  });

  // Publicar: os campos obrigatórios preenchidos e o texto final no conteúdo.
  override(DISCUSSION as any, 'onsubmit', function (this: any, original: (...args: unknown[]) => unknown, ...args: unknown[]) {
    const state = stateOf(this);

    if (state && templatesOn()) {
      if (state.template?.kind === 'form') {
        const missing = missingRequired(state.template.fields, state.values);

        if (missing.length) {
          state.invalid = new Set(missing.map((field) => field.key));
          app.alerts.show({ type: 'error' }, t('templates.missing_required', { field: missing[0].label }));
          focusField(missing[0].key);
          m.redraw();

          return undefined;
        }

        apply(this, state);
      } else if (!state.selected && state.candidates.some((template) => template.required)) {
        app.alerts.show({ type: 'error' }, t('templates.choose_required'));

        return undefined;
      }
    }

    return original(...args);
  });

  // Um formulário em branco (sem título e sem texto guardado) não é uma
  // mudança: fechar o composer não pergunta nada.
  override(DISCUSSION as any, 'hasChanges', function (this: any, original: () => boolean) {
    const state = stateOf(this);

    if (state?.template?.kind === 'form' && state.backup === null && !this.title?.() && !Object.values(state.values).some((value) => value.trim())) {
      return false;
    }

    return original();
  });
}
