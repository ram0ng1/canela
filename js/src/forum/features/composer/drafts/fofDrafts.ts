/*
 * A ponte entre o tema e o fof/drafts: os rascunhos moram no modelo `drafts`
 * da extensão (API `/api/drafts`, lista em `app.drafts`, contagem em
 * `user.draftCount`). O tema só cuida do desenho — o "⌄" do botão
 * "Iniciar Discussão", a aba do perfil, salvar sozinho e "Descartar" ao fechar.
 *
 * Sem o fof-drafts habilitado, `draftsOn()` é falso e nada disso aparece.
 */
import app from 'flarum/forum/app';
import { truncate } from 'flarum/common/utils/string';
import type Discussion from 'flarum/common/models/Discussion';

import { composerOn } from '../common';
import { t } from '../../../utils/settings';

/** O modelo `Draft` do fof/drafts (só o que o tema usa). */
export interface FofDraft {
  id(): string | undefined;
  exists: boolean;
  title(): string | null;
  content(): string;
  updatedAt(): Date | null | undefined;
  type(): 'reply' | 'privateDiscussion' | 'discussion';
  icon(): string;
  relationships(): Record<string, any> | null;
  loadRelationships(force?: boolean): Record<string, any>;
  save(data: Record<string, unknown>): Promise<FofDraft>;
  delete(body?: unknown, options?: unknown): Promise<void>;
}

interface FofDraftsState {
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  load(): void;
  loadMore(): void;
  deleteDraft(draft: FofDraft): void;
  showComposer(draft: FofDraft): Promise<unknown> | undefined;
}

export function fofDraftsInstalled(): boolean {
  return 'fof-drafts' in flarum.extensions;
}

/** Rascunhos valem agora: extensão ligada, pessoa logada com permissão e o recurso ligado no admin do tema. */
export function draftsOn(): boolean {
  return fofDraftsInstalled() && !!app.session.user && !!app.forum.attribute('canSaveDrafts') && composerOn('Drafts');
}

export function fofState(): FofDraftsState | null {
  return ((app as any).drafts as FofDraftsState | undefined) ?? null;
}

/** O fof/drafts guarda tópico novo e resposta; edição e mensagem do flarum/messages, não. */
export function draftableBody(): boolean {
  const composer = app.composer;

  return (
    !!composer.body?.componentClass &&
    (composer.bodyMatches('flarum/forum/components/DiscussionComposer') || composer.bodyMatches('flarum/forum/components/ReplyComposer'))
  );
}

export function draftsLoaded(): boolean {
  return !!(app.cache as any).draftsLoaded;
}

export function allDrafts(): FofDraft[] {
  return app.store
    .all<any>('drafts')
    .filter((draft: FofDraft) => draft.exists)
    .sort((a: FofDraft, b: FofDraft) => (b.updatedAt()?.getTime?.() ?? 0) - (a.updatedAt()?.getTime?.() ?? 0));
}

/** Quantos rascunhos a pessoa tem: o que já veio do servidor, ou a contagem do usuário antes disso. */
export function draftCount(): number {
  if (draftsLoaded()) return allDrafts().length;

  const count = (app.session.user as any)?.attribute?.('draftCount');

  return typeof count === 'number' && count > 0 ? count : 0;
}

function adjustCount(delta: number): void {
  const attributes = (app.session.user as any)?.data?.attributes;

  if (attributes) attributes.draftCount = Math.max(0, (Number(attributes.draftCount) || 0) + delta);
}

/** Pede a primeira página ao fof (uma vez por sessão) e avisa quando terminou. */
export function loadDrafts(): Promise<void> {
  const state = fofState();

  if (!state || !draftsOn()) return Promise.resolve();
  if (draftsLoaded()) return Promise.resolve();

  state.load();

  // O `load()` do fof não devolve a promessa: espera o `loading` baixar.
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if ((!state.loading && draftsLoaded()) || Date.now() - started > 15000) {
        clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

// ---------------------------------------------------------------------
// O composer aberto
// ---------------------------------------------------------------------

function relationshipRef(model: any): { type: string; id: string } | null {
  const id = typeof model?.id === 'function' ? model.id() : model?.id;
  const type = typeof model?.data?.type === 'function' ? model.data.type() : model?.data?.type || model?.type?.();

  return id && type ? { type: String(type), id: String(id) } : null;
}

/** O `data()` do corpo no formato da API do fof (relações como JSON:API). */
function payload(raw: Record<string, any>): Record<string, unknown> {
  const data: Record<string, any> = { ...raw };

  delete data.scheduledValidationError;
  delete data.updatedAt;

  if (raw.relationships) {
    data.relationships = {};

    Object.keys(raw.relationships).forEach((name) => {
      const rel = raw.relationships[name];

      if (Array.isArray(rel)) data.relationships[name] = { data: rel.map(relationshipRef).filter(Boolean) };
      else if (rel && typeof rel === 'object') data.relationships[name] = { data: relationshipRef(rel) };
    });
  }

  return data;
}

/** Há o que guardar: o fof só guarda rascunho com texto. */
export function hasContent(): boolean {
  return draftableBody() && !!(app.composer.fields?.content?.() || '').trim();
}

/** O texto mudou desde o último salvamento (o `changed()` que o fof põe no ComposerState). */
export function draftChanged(): boolean {
  return draftableBody() && !!(app.composer as any).changed?.();
}

/**
 * O salvamento em andamento, com o corpo do composer que ele grava. Dois
 * salvamentos seguidos do mesmo composer (o autosave e o "guardar" ao fechar,
 * por exemplo) não correm juntos: o segundo espera o primeiro e grava por cima
 * do rascunho que ele criou, em vez de criar outro.
 */
let inFlight: { body: unknown; promise: Promise<FofDraft | null> } | null = null;

/**
 * Salva o composer aberto no fof. Diferente do `saveDraft()` do fof, devolve a
 * promessa e só pendura o rascunho criado no composer se ele ainda é o mesmo:
 * salvar e fechar logo em seguida não deixa um rascunho velho no composer
 * seguinte (que passaria a gravar por cima dele).
 */
export function saveCurrentDraft(): Promise<void> {
  const composer: any = app.composer;

  if (!draftsOn() || !draftChanged() || typeof composer.data !== 'function') return Promise.resolve();

  const body = composer.body;
  // O texto de agora: quem fecha o composer logo depois não muda o que se grava.
  const data = payload(composer.data());
  const current: FofDraft | null = composer.draft || null;

  const run = (existing: FofDraft | null): Promise<FofDraft | null> => {
    // Apagado (na lista, em outra aba) antes de salvar: não ressuscita.
    if (existing && existing.id() && !existing.exists) return Promise.resolve(null);

    const request = existing ? existing.save(data) : (app.store.createRecord('drafts') as unknown as FofDraft).save(data);

    return request
      .then((saved: FofDraft) => {
        saved.loadRelationships(true);

        if (!existing) {
          adjustCount(1);
          if (composer.body === body) composer.draft = saved;
        }

        if (composer.body === body) composer.canelaDraftSavedAt = Date.now();

        return saved;
      })
      .catch(() => {
        if (composer.body === body) composer.canelaDraftError = true;

        return null;
      });
  };

  const previous = inFlight && inFlight.body === body ? inFlight.promise : null;
  const promise = previous ? previous.then((saved) => run(saved || current)) : run(current);

  inFlight = { body, promise };
  composer.saving = true;
  composer.canelaDraftError = false;
  m.redraw();

  return promise.then(() => {
    if (inFlight?.promise !== promise) return;

    inFlight = null;
    composer.saving = false;
    m.redraw();
  });
}

/** Apaga o rascunho do composer aberto, se houver. */
export function discardCurrentDraft(): Promise<void> {
  const composer: any = app.composer;
  const draft: FofDraft | null = composer.draft || null;

  composer.draft = null;

  if (!draft || !draft.exists) return Promise.resolve();

  return draft
    .delete()
    .then(() => {
      adjustCount(-1);
      m.redraw();
    })
    .catch(() => {});
}

/** O estado discreto do rodapé: salvando, salvo há pouco (até 3 s) ou nada. */
export function draftStatus(): 'saving' | 'saved' | 'error' | null {
  const composer: any = app.composer;

  if (composer.canelaDraftError) return 'error';
  if (composer.saving) return 'saving';
  if (composer.canelaDraftSavedAt && Date.now() - composer.canelaDraftSavedAt < 3000) return 'saved';

  return null;
}

// ---------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------

export function draftDiscussion(draft: FofDraft): Discussion | null {
  return (draft.loadRelationships().discussion as Discussion | null | undefined) || null;
}

export function replyDraftDiscussionId(draft: FofDraft): string | null {
  const ref = draft.relationships()?.discussion?.data;

  return ref?.id ? String(ref.id) : null;
}

const requested = new Set<string>();

/**
 * O fof não manda o tópico junto com o rascunho de resposta, e o título dele
 * é o que a lista mostra ("RE: …"). Busca os que faltam, um por vez.
 */
export function ensureDiscussions(drafts: FofDraft[]): void {
  drafts.forEach((draft) => {
    const id = draft.type() === 'reply' ? replyDraftDiscussionId(draft) : null;

    if (!id || requested.has(id) || app.store.getById('discussions', id)) return;

    requested.add(id);
    app.store
      .find<Discussion>('discussions', id, {}, { errorHandler: () => {} } as any)
      .then(() => {
        draft.loadRelationships(true);
        m.redraw();
      })
      .catch(() => {});
  });
}

/** O ícone do tipo: ↩ resposta, ✉ mensagem, ✎ tópico. */
export function draftIcon(draft: FofDraft): string {
  switch (draft.type()) {
    case 'reply':
      return 'fas fa-reply';
    case 'privateDiscussion':
      return 'fas fa-envelope';
    default:
      return 'fas fa-pen';
  }
}

/** O título da linha: "RE: <tópico>" na resposta, o título (ou o começo do texto) no tópico novo. */
export function draftTitle(draft: FofDraft): string {
  const excerpt = truncate((draft.content() || '').replace(/\s+/g, ' ').trim(), 100);

  if (draft.type() === 'reply') {
    const discussion = draftDiscussion(draft);

    return discussion ? t('composer.drafts.reply_title', { title: discussion.title() }) : excerpt || t('composer.drafts.unavailable');
  }

  return draft.title() || excerpt || t('composer.drafts.untitled');
}

/** Reabre o composer com o rascunho; numa resposta, vai antes para o tópico. */
export function openDraft(draft: FofDraft): void {
  const state = fofState();

  if (!state) return;

  const discussion = draft.type() === 'reply' ? draftDiscussion(draft) : null;

  if (discussion && app.current.get('discussion') !== discussion) {
    m.route.set(app.route.discussion(discussion));
  }

  state.showComposer(draft);
}

export function deleteDraft(draft: FofDraft): void {
  // O fof pergunta antes, ajusta a contagem e fecha o composer se era o dele.
  fofState()?.deleteDraft(draft);
}
