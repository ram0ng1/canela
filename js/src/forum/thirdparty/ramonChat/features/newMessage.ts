/*
 * (6) O gancho da "Nova mensagem": `openNewMessage()` abre o modal (chunk
 * próprio). A barra lateral do tema o recebe pelo `sidebarHooks.newMessage`
 * (o "+" das "Mensagens diretas"); qualquer outro botão pode chamá-lo.
 */
import app from 'flarum/forum/app';

import { feature } from './flags';

/** A "Nova mensagem" está disponível para o leitor. */
export function canStartNewMessage(): boolean {
  return feature('new_message') && !!app.session.user && !!app.forum.attribute<boolean>('canStartChatDirect');
}

export function openNewMessage(): void {
  if (!canStartNewMessage()) return;

  app.modal.show(() => import('./NewMessageModal'));
}
