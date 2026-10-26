/*
 * As rotas da aba "Mensagens" do perfil:
 * `/u/:username/messages` (Últimos) e `/u/:username/messages/:box` (Enviadas,
 * Novo, Não lidos, Arquivo).
 *
 * A primeira abre direto sem nada no PHP (a rota do perfil do core atende
 * `/u/{username}[/{filter}]`); a segunda vem do extend/messages.php. Sem o
 * flarum/messages a página só volta para o perfil.
 */
import Extend from 'flarum/common/extenders';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const UserMessagesPage = () => import('./UserMessagesPage');
import MessageReactedNotification from './MessageReactedNotification';

export default [
  // O cast: a tipagem do core 2.0.1 não aceita o UserPageResolver aqui, embora
  // o próprio flarum/likes o use do mesmo jeito.
  new Extend.Routes() //
    .add('user.messages', '/u/:username/messages', UserMessagesPage, UserPageResolver)
    .add('user.messages.box', '/u/:username/messages/:box', UserMessagesPage, UserPageResolver),

  // "Fulano reagiu à sua mensagem" (reações nas mensagens privadas).
  new Extend.Notification() //
    .add('canelaMessageReacted', MessageReactedNotification),
];
