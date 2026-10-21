/*
 * O compositor do ramon/chat com o que o do tema tem a mais:
 *
 * - (16) colar e arrastar imagens/arquivos: vão pelo mesmo envio do clipe do
 *   ramon/chat (`onFilesPicked` → `/api/chat/uploads` → `pendingUploads`),
 *   só com o mesmo direito (envio ligado no fórum e a permissão);
 * - (23) no @ do autocomplete, quem não participa do canal aparece depois dos
 *   membros com "não participa do canal" (o ramon/chat só lista membros, e
 *   mencionar alguém de fora parecia não ter efeito nenhum).
 *
 * O ChatComposer mora no chunk `chatUi`: os extends usam o nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import type User from 'flarum/common/models/User';

import { component, ct, feature } from './flags';

// ─── (16) Colar e arrastar ──────────────────────────────────────────────────

function canUpload(): boolean {
  return feature('paste_upload') && !!app.forum.attribute('ramon-chat.allowUploads') && !!app.forum.attribute('canUploadChatFiles');
}

function upload(composer: any, files: File[]): void {
  if (!files.length || typeof composer.onFilesPicked !== 'function') return;

  // O mesmo caminho do <input type=file> do ramon/chat: ele lê `target.files` e zera `value`.
  composer.onFilesPicked({ target: { files, value: '' } });
}

function bind(composer: any): void {
  const root: HTMLElement | null = composer.element || null;

  if (!root || composer.__canelaUploadRoot === root) return;

  composer.__canelaUploadRoot = root;

  root.addEventListener('paste', (e: ClipboardEvent) => {
    if (!canUpload()) return;

    const files = Array.from(e.clipboardData?.files || []);

    if (!files.length) return;

    // Texto colado junto (o nome do arquivo, em alguns sistemas) não entra.
    e.preventDefault();
    upload(composer, files);
  });

  root.addEventListener('dragover', (e: DragEvent) => {
    if (!canUpload() || !Array.from(e.dataTransfer?.types || []).includes('Files')) return;

    e.preventDefault();
    root.classList.add('CanelaRamonChat-dropping');
  });

  root.addEventListener('dragleave', (e: DragEvent) => {
    if (!root.contains(e.relatedTarget as Node | null)) root.classList.remove('CanelaRamonChat-dropping');
  });

  root.addEventListener('drop', (e: DragEvent) => {
    root.classList.remove('CanelaRamonChat-dropping');

    if (!canUpload()) return;

    const files = Array.from(e.dataTransfer?.files || []);

    if (!files.length) return;

    e.preventDefault();
    upload(composer, files);
  });
}

// ─── (23) Quem não participa do canal ───────────────────────────────────────

const OUTSIDERS_DELAY = 250;
const OUTSIDERS_LIMIT = 4;

function searchOutsiders(composer: any, term: string): void {
  window.clearTimeout(composer.__canelaOutsiderTimer);

  composer.__canelaOutsiders = null;

  if (!feature('mention_warning') || term.length < 2) return;

  const sequence = (composer.__canelaOutsiderSeq = (composer.__canelaOutsiderSeq || 0) + 1);

  composer.__canelaOutsiderTimer = window.setTimeout(() => {
    const channelId = Number(composer.attrs?.channel?.id?.());

    // Todos com o termo, menos os do canal (a mesma busca do ramon/chat).
    Promise.all([
      app.store.find<User[]>('users', { filter: { q: term }, page: { limit: 8 } } as any),
      app.store.find<User[]>('users', { filter: { q: term, chatChannel: channelId }, page: { limit: 20 } } as any),
    ])
      .then(([all, members]) => {
        if (sequence !== composer.__canelaOutsiderSeq) return;

        const inside = new Set((Array.isArray(members) ? members : []).map((user) => user.id()));

        composer.__canelaOutsiders = { term, users: (Array.isArray(all) ? all : []).filter((user) => !inside.has(user.id())) };
        m.redraw();
      })
      .catch(() => {});
  }, OUTSIDERS_DELAY);
}

/** Junta os de fora no fim da lista, sem repetir quem já veio como membro. */
function mergeOutsiders(composer: any): void {
  const extra = composer.__canelaOutsiders;
  const trigger = composer.trigger;

  if (!extra || !trigger || trigger.type !== '@' || trigger.term !== extra.term || !Array.isArray(composer.suggestions)) return;

  const me = app.session.user?.id();
  const listed = new Set(composer.suggestions.map((s: any) => s.user?.id?.()).filter(Boolean));
  const outsiders = (extra.users as User[])
    .filter((user) => user.id() !== me && !listed.has(user.id()))
    .slice(0, OUTSIDERS_LIMIT)
    .map((user) => ({
      key: `canela-outsider-${user.id()}`,
      insert: '@' + (user.slug() ?? user.username()),
      label: user.displayName(),
      hint: `@${user.username()} · ${ct('mention_warning.not_member')}`,
      user,
    }));

  const kept = composer.suggestions.filter((s: any) => !String(s.key).startsWith('canela-outsider-'));

  composer.suggestions = [...kept, ...outsiders];
}

export default function installComposer(): void {
  extend(component('ChatComposer'), 'oncreate', function (this: any) {
    bind(this);
  });

  // O elemento raiz troca entre "congelado", "devagar" e o compositor.
  extend(component('ChatComposer'), 'onupdate', function (this: any) {
    bind(this);
  });

  extend(component('ChatComposer'), 'suggestUsers', function (this: any, _value: unknown, ...args: unknown[]) {
    searchOutsiders(this, String(args[0] || ''));
  });

  override(component('ChatComposer'), 'view', function (this: any, original: () => any) {
    if (feature('mention_warning')) mergeOutsiders(this);

    return original();
  });
}
