/*
 * As denúncias abertas do chat (ramon/chat: `chat-message-flags`), agrupadas
 * pela mensagem, para a fila "Revisar" (review/ReviewQueue.tsx) e o painel de
 * revisão do menu do usuário (usermenu/panels.tsx). No pacote principal, e
 * não num dos dois chunks, para os dois o usarem sem um chunk compartilhado
 * (que o Flarum não registraria).
 */
import app from 'flarum/forum/app';

import { chatReviewOn } from './flags';

export interface ChatReport {
  /** `chat-<id da mensagem>`: a chave do item na lista. */
  key: string;
  message: any;
  /** Todas as denúncias abertas da mensagem, a mais recente primeiro. */
  flags: any[];
  /** A denúncia mais recente: a posição do item na fila. */
  date: Date;
}

/**
 * As denúncias abertas, uma entrada por mensagem. Recusado (403: o
 * ramon/chat de hoje só atende `ramon-chat.moderate`), devolve vazio sem
 * alerta — o pedido não foi do leitor.
 */
export async function loadChatReports(): Promise<ChatReport[]> {
  if (!chatReviewOn()) return [];

  let results: any[] = [];

  try {
    results = (await app.store.find(
      'chat-message-flags' as any,
      { filter: { resolved: '0' }, sort: '-createdAt', page: { limit: 50 } } as any,
      undefined,
      {
        errorHandler: (error: { status?: number }) => (error?.status === 401 || error?.status === 403 || error?.status === 404 ? undefined : false),
      } as any
    )) as any[];
  } catch {
    return [];
  }

  const byMessage = new Map<string, ChatReport>();

  Array.from(results || []).forEach((flag: any) => {
    const message = flag.message?.();

    if (!message) return;

    const key = `chat-${message.id()}`;
    const date: Date = flag.createdAt?.() || new Date(0);
    const entry = byMessage.get(key);

    if (entry) {
      entry.flags.push(flag);
      if (date > entry.date) entry.date = date;
    } else {
      byMessage.set(key, { key, message, flags: [flag], date });
    }
  });

  return Array.from(byMessage.values());
}

/** A fila "Revisar" já filtrada nas denúncias do chat, quando elas estão nela. */
export function reviewHref(): string | null {
  return chatReviewOn() && app.routes['flags'] ? app.route('flags', { type: 'chat' }) : null;
}
