/*
 * A conversa aberta (ChannelView do ramon/chat) com o que o chat do Discourse
 * tem a mais:
 *
 * - (11) a estrela do canal favorito no cabeçalho;
 * - (18) mensagens excluídas seguidas viram uma linha só, "N mensagens foram
 *   excluídas. [ver todas]";
 * - (19) o ponto na faixa da fixada quando há fixada que o leitor ainda não
 *   viu (a última vista fica no navegador, por canal);
 * - (22) "está digitando" sem websocket: sem o flarum/realtime, quem tem a
 *   conversa aberta pergunta ao servidor a cada poucos segundos
 *   (extend/ramonchat.php guarda o sinal no cache).
 *
 * O ChannelView mora no chunk `chatUi`: os extends usam o nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { apiUrl, chatState, childList, component, ct, feature, findByClass, pushChild, readLocal, rt, writeLocal } from './flags';
import { isStarred, toggleStar } from './starred';

// ─── (19) Fixadas não vistas ────────────────────────────────────────────────

function seenPins(): Record<string, number> {
  return readLocal<Record<string, number>>('pinsSeen', {});
}

function markPinSeen(channelId: number, messageId: number): void {
  const seen = seenPins();

  if ((seen[channelId] || 0) >= messageId) return;

  seen[channelId] = messageId;
  writeLocal('pinsSeen', seen);
}

/** Há fixada mais nova que a última que o leitor abriu neste canal. */
export function hasUnseenPin(channelId: number): boolean {
  const pinned = chatState()?.latestPinned?.(channelId);

  if (!pinned) return false;

  return Number(pinned.id()) > (seenPins()[channelId] || 0);
}

// ─── (18) Excluídas em sequência ────────────────────────────────────────────

/** As sequências abertas pelo leitor ("ver todas"), pela primeira mensagem. */
const expandedRuns = new Set<string>();

function isDeletedRow(vnode: any): boolean {
  const message = vnode?.attrs?.message;

  return !!message && typeof message.isDeleted === 'function' && !!message.isDeleted() && !message.isSystem?.();
}

function collapseDeleted(rows: any[]): any[] {
  const out: any[] = [];

  for (let i = 0; i < rows.length;) {
    if (!isDeletedRow(rows[i])) {
      out.push(rows[i]);
      i++;
      continue;
    }

    let end = i;
    while (end < rows.length && isDeletedRow(rows[end])) end++;

    const run = rows.slice(i, end);
    const key = `deleted-${run[0].attrs.message.id()}`;

    if (run.length < 2 || expandedRuns.has(key)) {
      out.push(...run);
    } else {
      out.push(
        <div key={key} className="ChatMessage ChatMessage--system CanelaRamonChat-deletedRun">
          <div className="ChatMessage-gutter" />
          <div className="ChatMessage-body">
            <button
              type="button"
              className="ChatMessage-tombstone CanelaRamonChat-deletedRun-button"
              onclick={() => {
                expandedRuns.add(key);
              }}
            >
              {ct('deleted', { count: run.length })}
            </button>
          </div>
        </div>
      );
    }

    i = end;
  }

  return out;
}

// ─── (22) Digitando, por polling ────────────────────────────────────────────

const POLL_MS = 3000;
let pollTimer: number | null = null;
let polledChannel: number | null = null;

function realtimeOn(): boolean {
  return 'flarum-realtime' in flarum.extensions;
}

function pollTyping(): void {
  pollTimer = null;

  const state = chatState();
  const channelId = polledChannel;

  if (!state || channelId === null || !feature('typing_poll') || realtimeOn()) return;

  // Só com a conversa à vista; a aba escondida espera.
  if (!document.hidden && document.querySelector('.ChatChannel')) {
    app
      .request<{ data: { userId: number; username: string }[] }>({
        method: 'GET',
        url: apiUrl(`/canela-ramon-chat/channels/${channelId}/typing`),
        errorHandler: () => {},
      } as any)
      .then((result) => {
        (result?.data || []).forEach((entry) => state.noteTyping(channelId, entry.userId, entry.username, true, 5));
        m.redraw();
      })
      .catch(() => {});
  }

  pollTimer = window.setTimeout(pollTyping, POLL_MS);
}

function startTypingPoll(channelId: number): void {
  if (realtimeOn() || !feature('typing_poll')) return;

  polledChannel = channelId;

  if (pollTimer === null) pollTimer = window.setTimeout(pollTyping, POLL_MS);
}

function stopTypingPoll(channelId: number): void {
  if (polledChannel !== channelId) return;

  polledChannel = null;

  if (pollTimer !== null) window.clearTimeout(pollTimer);
  pollTimer = null;
}

export default function installChannelView(): void {
  extend(component('ChannelView'), 'header', function (this: any, vnode: any) {
    if (!vnode || !feature('starred')) return;

    const channel = this.attrs.channel;
    const actions = findByClass(vnode, 'ChatChannel-headerActions');

    if (!actions || !channel) return;

    const starred = isStarred(channel.id());
    const label = starred ? rt('star.remove') : ct('channel_settings.star_channel');

    pushChild(
      childList(actions),
      <Button
        className={classList('Button Button--icon Button--flat CanelaRamonChat-star', { 'ChatChannel-headerAction--active': starred })}
        icon={starred ? 'fas fa-star' : 'far fa-star'}
        title={label}
        aria-label={label}
        aria-pressed={starred ? 'true' : 'false'}
        onclick={() => toggleStar(channel.id())}
      />,
      'canela-star',
      0
    );
  });

  extend(component('ChannelView'), 'pinnedBar', function (this: any, vnode: any) {
    if (!vnode || typeof vnode !== 'object' || !feature('pin_indicator')) return;

    const channelId = Number(this.attrs.channel.id());
    const pinned = chatState()?.latestPinned?.(channelId);

    if (!pinned) return;

    const markSeen = () => markPinSeen(channelId, Number(pinned.id()));

    vnode.attrs = vnode.attrs || {};

    // Abrir a fixada (pular até ela ou ver todas) conta como ver.
    const previous = vnode.attrs.onclick;
    vnode.attrs.onclick = (e: Event) => {
      markSeen();
      previous?.(e);
    };

    if (!hasUnseenPin(channelId)) return;

    const key = 'className' in vnode.attrs || !('class' in vnode.attrs) ? 'className' : 'class';
    vnode.attrs[key] = `${vnode.attrs[key] || ''} CanelaRamonChat-pinnedBar--unseen`.trim();

    const jump = findByClass(vnode, 'ChatChannel-pinnedBar-jump');

    if (jump) childList(jump).push(<span className="CanelaRamonChat-unseenDot" title={rt('pins.unseen')} aria-label={rt('pins.unseen')} />);
  });

  // O painel das fixadas aberto também conta como ver todas.
  extend(component('PinnedPanel'), 'oncreate', function (this: any) {
    const channelId = Number(this.attrs?.channel?.id?.());
    const pinned = channelId ? chatState()?.latestPinned?.(channelId) : null;

    if (pinned) markPinSeen(channelId, Number(pinned.id()));
  });

  override(component('ChannelView'), 'rows', function (this: any, original: (...args: any[]) => any[], ...args: any[]) {
    const rows = original(...args);

    return feature('collapse_deleted') && Array.isArray(rows) ? collapseDeleted(rows) : rows;
  });

  extend(component('ChannelView'), 'oncreate', function (this: any) {
    startTypingPoll(Number(this.attrs.channel.id()));
  });

  extend(component('ChannelView'), 'onupdate', function (this: any) {
    const id = Number(this.attrs.channel.id());

    if (polledChannel !== id) startTypingPoll(id);
  });

  extend(component('ChannelView'), 'onremove', function (this: any) {
    stopTypingPoll(Number(this.attrs.channel.id()));
  });
}
