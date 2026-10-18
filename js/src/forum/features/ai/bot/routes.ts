/*
 * Rotas da página de conversas com o bot e os atalhos que levam até ela.
 * Ficam fora da ConversationsPage para a página poder ir num chunk próprio:
 * quem só precisa do nome da rota ou do "Perguntar à IA" não puxa a página.
 */
import app from 'flarum/forum/app';

import { conversations } from './ConversationsState';

export const CONVERSATIONS_ROUTE = 'canela.ai.conversations';
export const CONVERSATION_ROUTE = 'canela.ai.conversation';

/** O "Perguntar à IA" da busca abre a página já com a pergunta enviada. */
export function askAi(question: string): void {
  // Já na "Nova pergunta": a mesma URL não recria a página, então manda daqui.
  if (app.current.get('routeName') === CONVERSATIONS_ROUTE && conversations.currentId === null) {
    conversations.send(question);
    return;
  }

  conversations.pendingQuestion = question;
  m.route.set(app.route(CONVERSATIONS_ROUTE));
}

export function isConversationsRoute(): boolean {
  const name = app.current.get('routeName');

  return name === CONVERSATIONS_ROUTE || name === CONVERSATION_ROUTE;
}
