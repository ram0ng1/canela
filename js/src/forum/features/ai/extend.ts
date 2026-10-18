/*
 * Extenders do fórum para a IA: as rotas da página de conversas e os
 * atributos de IA dos tópicos. O agente principal espalha este array no
 * `extend` do fórum.
 */
import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';

import { CONVERSATIONS_ROUTE, CONVERSATION_ROUTE } from './bot/routes';

// A página vai num chunk próprio, carregado só quando a rota abre.
const ConversationsPage = () => import('./bot/ConversationsPage');

export default [
  new Extend.Routes() //
    .add(CONVERSATIONS_ROUTE, '/ai/conversations', ConversationsPage)
    .add(CONVERSATION_ROUTE, '/ai/conversations/:id', ConversationsPage),

  new Extend.Model(Discussion) //
    .attribute<string | null>('canelaAiGist')
    .attribute<boolean>('canelaAiHasSummary')
    .attribute<boolean>('canelaAiSummarizable'),
];
