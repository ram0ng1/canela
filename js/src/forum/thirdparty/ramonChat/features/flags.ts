/*
 * As chaves do admin dos recursos que o tema põe por cima do ramon/chat
 * (extend/ramonchat.php serializa `canelaRamonChat`), as preferências do
 * leitor e as traduções. Sem o atributo (o recurso `ramonchat` fora do
 * extend/.enabled) nenhum recurso liga: vários dependem dos endpoints dele.
 */
import app from 'flarum/forum/app';

import { t } from '../../../utils/settings';

export type RamonChatFeature =
  | 'preferences'
  | 'header_indicator'
  | 'quick_reactions'
  | 'drawer_shortcut'
  | 'bell'
  | 'new_message'
  | 'group_name'
  | 'self_dm'
  | 'dm_guard'
  | 'starred'
  | 'tag_cleanup'
  | 'auto_join'
  | 'permalink'
  | 'restore'
  | 'paste_upload'
  | 'long_press'
  | 'collapse_deleted'
  | 'pin_indicator'
  | 'retention'
  | 'delete_confirm'
  | 'typing_poll'
  | 'mention_warning'
  | 'review_flags';

interface RamonChatAttrs {
  features: Partial<Record<RamonChatFeature, boolean>>;
  dmMax: number;
  retentionDays: number;
  dmRetentionDays: number;
}

export function attrs(): RamonChatAttrs | null {
  return (app.forum?.attribute<RamonChatAttrs>('canelaRamonChat') as RamonChatAttrs | undefined) ?? null;
}

/** O recurso está ligado no admin (e o leitor pode usar o chat). */
export function feature(name: RamonChatFeature): boolean {
  return !!attrs()?.features?.[name];
}

/** A aba Chat das preferências mostra a seção do ramon/chat (user/preferences/tabs.ts). */
export function ramonChatPreferencesOn(): boolean {
  return 'ramon-chat' in flarum.extensions && feature('preferences') && !!app.forum?.attribute<boolean>('canUseChat') && !!app.session.user;
}

/**
 * As denúncias do chat entram na fila "Revisar" do tema (review/, o menu do
 * usuário e a barra lateral). Para quem vê as sinalizações dos posts
 * (`discussion.viewFlags`, o `canViewFlags` do flarum/flags) ou modera o chat
 * (`ramon-chat.moderate`, o `canModerateChat`).
 *
 * Hoje o endpoint `chat-message-flags` do ramon/chat só aceita a segunda; a
 * fila pede em silêncio e, recusada, fica só com os posts — quando ele passar
 * a aceitar `discussion.viewFlags`, as denúncias aparecem sem mudar nada aqui.
 */
export function chatReviewOn(): boolean {
  if (!('ramon-chat' in flarum.extensions) || !feature('review_flags') || !app.forum) return false;

  return !!app.forum.attribute<boolean>('canModerateChat') || !!app.forum.attribute<boolean>('canViewFlags');
}

/**
 * O ramon/chat já soma as denúncias do chat na contagem do flarum/flags
 * (`flagCount` / `newFlagCount`)? Hoje não: a contagem dele é o
 * `chatOpenFlagsCount`, à parte. Quando passar a somar, ele deve avisar com o
 * atributo do fórum `chatFlagsInFlagCount: true` — com ele, o tema para de
 * somar o `chatOpenFlagsCount` por cima, e nada é contado duas vezes.
 */
export function chatCountedByFlags(): boolean {
  return !!app.forum?.attribute<boolean>('chatFlagsInFlagCount');
}

/** Quantas denúncias do chat somar aos contadores de revisão (0 se já vêm na do flarum/flags). */
export function chatReviewCount(): number {
  if (!chatReviewOn() || chatCountedByFlags()) return 0;

  return Number(app.forum.attribute<number>('chatOpenFlagsCount') || 0);
}

export function dmMax(): number {
  return attrs()?.dmMax || 20;
}

export function apiUrl(path: string): string {
  return `${app.forum.attribute<string>('apiUrl')}${path}`;
}

/** Uma preferência do leitor, com o padrão quando não há valor. */
export function pref<T>(key: string, fallback: T): T {
  const value = app.session.user?.preferences()?.[key];

  return value === undefined || value === null ? fallback : (value as T);
}

/** Tradução dos recursos (`ramon-canela.forum.ramon_chat.*`). */
export function rt(key: string, params: Record<string, unknown> = {}): string {
  return t(`ramon_chat.${key}`, params);
}

/** As traduções do chat próprio do tema (`ramon-canela.forum.chat.*`), reaproveitadas. */
export function ct(key: string, params: Record<string, unknown> = {}): string {
  return t(`chat.${key}`, params);
}

/** Um módulo do ramon/chat pelo registro (nunca `import`: sem a extensão, o tema quebraria). */
export function ramonModule<T = any>(id: string): T | null {
  try {
    return ((flarum as any).reg.checkModule('ramon-chat', id) as T) || null;
  } catch {
    return null;
  }
}

/** O estado global do chat (`forum/state/chat`). */
export function chatState(): any {
  return ramonModule('forum/state/chat');
}

/** O caminho de um componente do ramon/chat para `extend()`/`override()` (também os do chunk `chatUi`). */
export function component(name: string): any {
  return `ext:ramon/chat/forum/components/${name}`;
}

export function isPhone(): boolean {
  return app.screen() === 'phone';
}

/** Mithril: numa lista, ou todos têm `key` ou nenhum — a chave só vai se os irmãos já tiverem. */
export function pushChild(children: any[], child: any, key: string, index = children.length): void {
  if (!child) return;

  const keyed = children.some((c) => c && typeof c === 'object' && c.key != null);

  if (keyed && typeof child === 'object') child.key = key;

  children.splice(index, 0, child);
}

/** Acha o primeiro vnode com esta classe na árvore. */
export function findByClass(node: any, className: string): any {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByClass(child, className);
      if (found) return found;
    }

    return null;
  }

  const classes = String(node.attrs?.className || node.attrs?.class || '');

  if (typeof node.tag === 'string' && classes.split(/\s+/).includes(className)) return node;

  return findByClass(node.children, className);
}

/** Os filhos de um vnode como lista editável (o JSX com um array só deixa o array direto). */
export function childList(vnode: any): any[] {
  // Um filho só de texto vira `vnode.text` no Mithril: volta a ser um filho.
  if (vnode.text != null) {
    vnode.children = [m.fragment({}, [String(vnode.text)])];
    vnode.text = undefined;
  }

  if (!Array.isArray(vnode.children)) vnode.children = vnode.children == null ? [] : [vnode.children];

  return vnode.children;
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();

  return Promise.resolve();
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`canela.ramonChat.${key}`);

    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(`canela.ramonChat.${key}`, JSON.stringify(value));
  } catch {
    // Sem armazenamento: vale até recarregar.
  }
}
