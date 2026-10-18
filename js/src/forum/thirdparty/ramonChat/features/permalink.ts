/*
 * (14) O link permanente da mensagem, como o do Discourse: `/chat/c/ID?message=MSG`
 * (ou o do fio, `/chat/c/ID/t/FIO?message=MSG`). Ao abrir, a página do chat
 * carrega a conversa até a mensagem (o `revealMessage` do ramon/chat), rola
 * até ela e a destaca. É o endereço do "Copiar link" e dos avisos do sino.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';

import { chatState, component, feature, ramonModule } from './flags';

/** O endereço absoluto de uma mensagem. */
export function messageUrl(message: any): string {
  const channelId = Number(message.channelId?.() ?? message.channelId);
  const threadId = message.threadId?.();
  const params: Record<string, unknown> = { id: channelId, message: message.id?.() ?? message.id };
  const path = threadId ? app.route('chat.thread', { ...params, threadId }) : app.route('chat.channel', params);

  return new URL(path, window.location.origin).href;
}

/** O caminho (relativo) de uma mensagem a partir dos números, para os avisos do sino. */
export function messagePath(channelId: number, messageId: number, threadId?: number | null): string {
  return threadId
    ? app.route('chat.thread', { id: channelId, threadId, message: messageId })
    : app.route('chat.channel', { id: channelId, message: messageId });
}

/** Mensagens já levadas à tela nesta visita (o `view` roda a cada redesenho). */
const handled = new Set<string>();

async function reveal(channelId: number, messageId: number, inThread: boolean): Promise<void> {
  const jump = ramonModule<{ jumpToMessage?: (id: number, from?: HTMLElement | null) => boolean; revealAndJump?: (...a: any[]) => Promise<boolean> }>(
    'forum/utils/jumpToMessage'
  );

  if (!jump?.jumpToMessage) return;

  // O fio desenha a própria lista; espera ela existir e tenta de novo.
  for (let attempt = 0; attempt < 24; attempt++) {
    const scroller = document.querySelector<HTMLElement>(inThread ? '.ChatThreadPanel-stream' : '.ChatChannel-stream');

    if (scroller) {
      if (jump.jumpToMessage(messageId, scroller)) return;

      if (!inThread && jump.revealAndJump) {
        await jump.revealAndJump(chatState(), channelId, messageId, scroller);
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export default function installPermalink(): void {
  extend(component('ChatPage'), 'view', function (this: any) {
    if (!feature('permalink')) return;

    const messageId = Number(m.route.param('message'));
    const channelId = Number(m.route.param('id'));

    if (!messageId || !channelId) return;

    const key = `${channelId}:${messageId}`;
    const state = chatState();

    if (handled.has(key) || !state || state.activeChannelId !== channelId || !state.stream(channelId)?.loadedInitial) return;

    handled.add(key);

    // Depois deste desenho: a lista precisa estar na tela para rolar.
    setTimeout(() => reveal(channelId, messageId, !!m.route.param('threadId')).then(() => m.redraw()), 0);
  });
}
