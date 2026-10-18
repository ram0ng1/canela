/*
 * As ações da mensagem do ramon/chat com o que o chat do Discourse tem a mais:
 *
 * - (3) as três reações de um clique (as mais usadas pelo leitor, ou as que
 *   ele escolheu nas Configurações), ao lado do 👍 fixo do ramon/chat;
 * - (14) "Copiar link" — o endereço da mensagem (`?message=ID`, ver permalink.ts);
 * - (15) "Restaurar" no aviso de mensagem excluída (o `canRestore` que o tema
 *   serializa; o endpoint `restore` já é do ramon/chat);
 * - (17) no celular, segurar a mensagem abre a folha de ações que sobe de
 *   baixo, com as mesmas ações da barrinha (lidas do próprio `actions()`).
 *
 * O ChatMessage mora no chunk `chatUi`: os extends usam o nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { apiUrl, childList, component, copyText, ct, feature, findByClass, isPhone, pref, ramonModule, readLocal, writeLocal } from './flags';
import { messageUrl } from './permalink';

/** O 👍 do ramon/chat, que já tem o botão dele. */
const LIKE = '+1';

/** Para as três rápidas enquanto o leitor ainda não reagiu a nada. */
const DEFAULTS = ['heart', 'laughing', 'tada'];

/** O bastante para desenhar as padrão antes de o mapa de emoji do ramon/chat descer. */
const COMMON: Record<string, string> = { heart: '❤️', laughing: '😆', tada: '🎉', '+1': '👍', eyes: '👀', fire: '🔥', smile: '😄', clap: '👏' };

function display(code: string): string {
  const emoji = ramonModule<{ displayEmoji?: (c: string) => string }>('forum/utils/emoji');

  try {
    return emoji?.displayEmoji ? emoji.displayEmoji(code) : COMMON[code] || `:${code}:`;
  } catch {
    return COMMON[code] || `:${code}:`;
  }
}

/** O nome do emoji (o ramon/chat só aceita o shortcode na reação). */
function shortcode(token: string): string | null {
  const clean = token.replace(/^:+|:+$/g, '').trim();

  if (/^[a-z0-9_+-]{1,60}$/i.test(clean)) return clean.toLowerCase();

  // Um emoji colado: o mapa do ramon/chat (unicode → nomes), se já desceu.
  const map = ramonModule<{ default?: Record<string, string[]> }>('forum/utils/emojiMap');
  const names = (map?.default ?? (map as any))?.[clean];

  return Array.isArray(names) && names[0] ? String(names[0]) : null;
}

/** As três reações de um clique do leitor, sem o 👍 (que já tem botão). */
export function quickReactions(): string[] {
  let list: string[] = [];

  if (pref<string>('canelaRamonChatQuickReactions', 'frequent') === 'custom') {
    list = String(pref('canelaRamonChatQuickReactionsCustom', ''))
      .split(/[\s,]+/)
      .map((token) => (token ? shortcode(token) : null))
      .filter((code): code is string => !!code);
  } else {
    const counts = readLocal<Record<string, number>>('reactionCounts', {});

    list = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);
  }

  return [...new Set([...list, ...DEFAULTS])].filter((code) => code !== LIKE).slice(0, 3);
}

function countReaction(code: string): void {
  const counts = readLocal<Record<string, number>>('reactionCounts', {});

  counts[code] = (counts[code] || 0) + 1;
  writeLocal('reactionCounts', counts);
}

function quickButtons(cmp: any, message: any, className: string): Mithril.Children[] {
  const summary = message.reactionSummary?.() || {};

  return quickReactions().map((code) => {
    const reacted = !!summary[code]?.reacted;
    const label = reacted ? ct('reactions.remove', { emoji: display(code) }) : ct('reactions.add', { emoji: display(code) });

    return (
      <Button
        className={classList(className, 'CanelaRamonChat-quickReaction', { 'ChatMessage-action--active': reacted })}
        title={label}
        aria-label={label}
        onclick={(e: Event) => {
          e.stopPropagation();
          cmp.react(message, code);
        }}
      >
        <span className="CanelaRamonChat-quickReaction-emoji">{display(code)}</span>
      </Button>
    );
  });
}

function copyLink(message: any): void {
  copyText(messageUrl(message)).then(() => app.alerts.show({ type: 'success' }, ct('link_copied')));
}

async function restore(message: any): Promise<void> {
  try {
    const payload = await app.request<any>({ method: 'POST', url: apiUrl(`/chat-messages/${message.id()}/restore`) });

    app.store.pushPayload(payload);
  } catch {
    // O alerta do core já disse o que houve.
  } finally {
    m.redraw();
  }
}

// ─── Folha do celular ───────────────────────────────────────────────────────

/** Os botões da barrinha do ramon/chat, com o rótulo que eles levam no `aria-label`. */
function actionRows(cmp: any, message: any): { icon: string; label: string; active: boolean; run: () => void }[] {
  const bar = cmp.actions(message);
  const rows: { icon: string; label: string; active: boolean; run: () => void }[] = [];

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);

    const attrs = node.attrs || {};

    // As reações vão na fileira de cima, não na lista.
    if (typeof attrs.onclick === 'function' && !String(attrs.className || '').includes('CanelaRamonChat-quickReaction')) {
      rows.push({
        icon: attrs.icon || 'fas fa-circle',
        label: String(attrs['aria-label'] || attrs.title || ''),
        active: String(attrs.className || '').includes('--active'),
        run: () => attrs.onclick({ stopPropagation() {}, preventDefault() {}, currentTarget: null }),
      });

      return;
    }

    walk(node.children);
  };

  walk(bar?.children);

  return rows;
}

/** O começo da mensagem no topo da folha (o `messagePreview` do ramon/chat, ou o texto cru). */
function sheetPreview(preview: { messagePreview?: (m: any, n?: number) => string } | null, message: any): string {
  try {
    const text = preview?.messagePreview ? preview.messagePreview(message, 120) : '';

    if (text) return text;
  } catch {
    // Cai no texto cru.
  }

  const raw = String(message.content?.() || '');

  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

let sheetOpen = false;

function openSheet(cmp: any, message: any): void {
  if (sheetOpen) return;
  sheetOpen = true;

  const portal = document.createElement('div');
  portal.className = 'CanelaRamonChatSheet-outlet';
  document.body.appendChild(portal);

  let closing = false;

  const close = () => {
    if (closing) return;
    closing = true;
    portal.classList.add('is-closing');

    setTimeout(() => {
      m.mount(portal, null);
      portal.remove();
      sheetOpen = false;
    }, 180);
  };

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const preview = ramonModule<{ messagePreview?: (m: any, n?: number) => string }>('common/utils/preview');

  m.mount(portal, {
    view: () => {
      const rows = actionRows(cmp, message);
      const canReact = !message.isDeleted?.() && message.canReact?.();

      return (
        <div className="CanelaRamonChatSheet-backdrop" onclick={close}>
          <div className="CanelaRamonChatSheet" role="dialog" aria-label={ct('message_actions')} onclick={(e: Event) => e.stopPropagation()}>
            <div className="CanelaRamonChatSheet-preview">{sheetPreview(preview, message)}</div>

            {canReact && feature('quick_reactions') && (
              <div className="CanelaRamonChatSheet-reactions">
                {[LIKE, ...quickReactions()].map((code) => (
                  <button
                    type="button"
                    className={classList('CanelaRamonChatSheet-reaction', { reacted: !!message.reactionSummary?.()?.[code]?.reacted })}
                    aria-label={ct('reactions.add', { emoji: display(code) })}
                    onclick={run(() => cmp.react(message, code))}
                  >
                    {display(code)}
                  </button>
                ))}
              </div>
            )}

            <ul className="CanelaRamonChatSheet-actions">
              {rows.map((row) => (
                <li>
                  <button type="button" className={classList('CanelaRamonChatSheet-action', { active: row.active })} onclick={run(row.run)}>
                    <Icon name={row.icon} />
                    <span>{row.label}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="CanelaRamonChatSheet-action"
                  onclick={run(() => copyText(message.content?.() || '').then(() => app.alerts.show({ type: 'success' }, ct('text_copied'))))}
                >
                  <Icon name="far fa-clipboard" />
                  <span>{ct('copy_text')}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      );
    },
  });
}

/** Segurar (meio segundo, sem arrastar) abre a folha. */
function bindLongPress(cmp: any, dom: HTMLElement): void {
  if ((dom as any).__canelaLongPress) return;
  (dom as any).__canelaLongPress = true;

  let timer: number | null = null;
  let fired = false;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };

  dom.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (!feature('long_press') || !isPhone() || e.touches.length !== 1) return;

      const message = cmp.attrs?.message;

      // Na seleção, o toque marca a mensagem; nos links e botões, faz o dele.
      if (!message || message.isSystem?.() || cmp.attrs?.state?.selecting) return;
      if ((e.target as HTMLElement).closest('a, button, input, textarea, .ChatMessage-actions')) return;

      fired = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      timer = window.setTimeout(() => {
        timer = null;
        fired = true;
        navigator.vibrate?.(10);
        openSheet(cmp, cmp.attrs.message);
      }, 500);
    },
    { passive: true }
  );

  dom.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (timer === null) return;

      const touch = e.touches[0];

      if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) cancel();
    },
    { passive: true }
  );

  dom.addEventListener('touchend', (e: TouchEvent) => {
    cancel();

    // O toque que abriu a folha não vira clique na mensagem.
    if (fired) {
      e.preventDefault();
      fired = false;
    }
  });

  dom.addEventListener('touchcancel', cancel);

  // O menu do navegador (copiar, selecionar) brigaria com a folha.
  dom.addEventListener('contextmenu', (e: Event) => {
    if (feature('long_press') && isPhone() && fired) e.preventDefault();
  });
}

export default function installMessageActions(): void {
  // Conta as reações do leitor, para as "mais usadas".
  override(component('ChatMessage'), 'react', function (this: any, original: (message: any, emoji: string) => Promise<void>, ...args: unknown[]) {
    const [message, emoji] = args as [any, string];
    const was = !!message?.reactionSummary?.()?.[emoji]?.reacted;

    if (!was && emoji !== LIKE) countReaction(emoji);

    return original(message, emoji);
  });

  extend(component('ChatMessage'), 'actions', function (this: any, vnode: any, message: any) {
    if (!vnode || typeof vnode !== 'object') return;

    const items = childList(vnode);

    if (feature('quick_reactions') && message.canReact?.()) {
      const likeIndex = items.findIndex((item: any) => /thumbs-up/.test(String(item?.attrs?.icon || '')));

      items.splice(likeIndex + 1, 0, ...quickButtons(this, message, 'ChatMessage-action'));
    }

    if (feature('permalink') && !message.isDeleted?.()) {
      const link = (
        <Button
          className="ChatMessage-action CanelaRamonChat-copyLink"
          icon="fas fa-link"
          title={ct('copy_link')}
          aria-label={ct('copy_link')}
          onclick={(e: Event) => {
            e.stopPropagation();
            copyLink(message);
          }}
        />
      );

      // Antes de denunciar e excluir: as ações que mexem com outras pessoas ficam no fim.
      const before = items.findIndex((item: any) => /fa-flag|fa-trash/.test(String(item?.attrs?.icon || '')));

      items.splice(before === -1 ? items.length : before, 0, link);
    }
  });

  extend(component('ChatMessage'), 'tombstone', function (this: any, vnode: any, message: any) {
    if (!feature('restore') || !vnode || !message?.attribute?.('canRestore')) return;

    const target = findByClass(vnode, 'ChatMessage-tombstone') || vnode;

    childList(target).push(
      <Button
        className="Button Button--flat Button--icon ChatMessage-restore CanelaRamonChat-restore"
        icon="fas fa-arrow-rotate-left"
        title={ct('restore')}
        aria-label={ct('restore')}
        onclick={(e: Event) => {
          e.stopPropagation();
          restore(message);
        }}
      />
    );
  });

  extend(component('ChatMessage'), 'oncreate', function (this: any, _value: unknown, vnode: any) {
    if (vnode?.dom instanceof HTMLElement) bindLongPress(this, vnode.dom);
  });

  // A mesma linha pode trocar de elemento (mensagem que vira de sistema).
  extend(component('ChatMessage'), 'onupdate', function (this: any, _value: unknown, vnode: any) {
    if (vnode?.dom instanceof HTMLElement) bindLongPress(this, vnode.dom);
  });
}
