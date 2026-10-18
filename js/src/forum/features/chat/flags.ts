/*
 * O mínimo do chat que mora no pacote principal: a tradução e as permissões
 * do `canelaChat`. O resto (store, gaveta, barra lateral) só desce quando o
 * chat está ligado para o leitor (ver index.tsx).
 */
import app from 'flarum/forum/app';

import { t } from '../../utils/settings';
import type { ChatCapabilities } from './types';

/** Tradução do chat (`ramon-canela.forum.chat.*`), já como texto. */
export function ct(key: string, params: Record<string, unknown> = {}): string {
  return t(`chat.${key}`, params);
}

export function caps(): ChatCapabilities {
  return (app.forum?.attribute<ChatCapabilities>('canelaChat') || { enabled: false }) as ChatCapabilities;
}

/** O chat aparece para o leitor: ligado no admin, logado e com permissão. */
export function chatOn(): boolean {
  const c = caps();

  return !!(c.enabled && c.canUse && app.session.user);
}
