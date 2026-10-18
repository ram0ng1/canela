/*
 * Ganchos da barra lateral do ramon/chat para os recursos que estendem o chat
 * (js/src/forum/thirdparty/ramonChat/features): quem implementa um recurso
 * registra aqui a sua função, e a barra a usa quando ela existe.
 *
 * - `newMessage`: o "+" das "Mensagens diretas" (a "Nova mensagem" do
 *   Discourse). Sem gancho, a seção não mostra o "+".
 * - `sortChannels`: a ordem dos canais e das MDs (por exemplo, os com estrela
 *   primeiro). Sem gancho, vale a ordem do ramon/chat.
 * - `channelSuffix`: algo a mais no fim da linha do canal (a estrela, por
 *   exemplo), antes do indicador de não lidas.
 */
import type Mithril from 'mithril';

import type { RamonChannel } from './bridge';

export interface RamonChatSidebarHooks {
  newMessage?: () => void;
  sortChannels?: (channels: RamonChannel[], section: 'channels' | 'direct') => RamonChannel[];
  channelSuffix?: (channel: RamonChannel) => Mithril.Children;
}

export const sidebarHooks: RamonChatSidebarHooks = {};

/** Registra (ou troca) ganchos da barra lateral. */
export function registerSidebarHooks(hooks: RamonChatSidebarHooks): void {
  Object.assign(sidebarHooks, hooks);
}

/** Aplica um gancho sem deixar um erro dele derrubar a barra lateral inteira. */
export function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.error('[ramon-canela] gancho do chat falhou:', e);
    return fallback;
  }
}
