/*
 * Extenders do fórum para o chat: as rotas da página cheia e os alertas.
 *
 * As rotas existem sempre: os extenders rodam antes de o fórum saber das
 * configurações. Com o chat desligado, o servidor responde 404 a quem chega
 * pelo endereço e a página manda de volta para o início.
 *
 * A ordem importa: o Mithril escolhe a primeira rota que casa, e
 * `/chat/c/:slug/:id/:rest...` (fios, fixadas, informações, a mensagem) vem
 * depois das fixas.
 */
import Extend from 'flarum/common/extenders';

// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const ChatPage = () => import('./components/chatUi').then((ui) => ({ default: ui.default.ChatPage }));
import { ChatMentionNotification, ChatMessageNotification } from './notifications';

const routes = new Extend.Routes()
    .add('canela.chat', '/chat', ChatPage)
    .add('canela.chat.browse', '/chat/browse', ChatPage)
    .add('canela.chat.browseFilter', '/chat/browse/:filter', ChatPage)
    .add('canela.chat.newMessage', '/chat/new-message', ChatPage)
    .add('canela.chat.channels', '/chat/channels', ChatPage)
    .add('canela.chat.directMessages', '/chat/direct-messages', ChatPage)
    .add('canela.chat.threads', '/chat/threads', ChatPage)
    .add('canela.chat.search', '/chat/search', ChatPage)
    .add('canela.chat.channel', '/chat/c/:slug/:id', ChatPage)
    .add('canela.chat.channelSub', '/chat/c/:slug/:id/:rest...', ChatPage);

/**
 * Com outra extensão de chat ligada (ramon/chat) o endereço /chat é dela: o
 * servidor já retira a rota do tema (Support\RouteConflictGuard) e aqui as
 * páginas do tema também não se registram. A checagem roda na hora de
 * aplicar os extenders, quando todas as extensões já carregaram.
 */
const chatRoutes = {
  extend(app: any, extension: any) {
    if ('ramon-chat' in flarum.extensions) return;

    routes.extend(app, extension);
  },
};

export default [
  chatRoutes,

  new Extend.Notification() //
    .add('canelaChatMention', ChatMentionNotification)
    .add('canelaChatMessage', ChatMessageNotification),
];
