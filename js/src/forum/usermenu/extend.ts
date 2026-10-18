/*
 * A rota da aba "Notificações" do perfil. O servidor já atende
 * `/u/{username}[/{filter}]` com a página do perfil: a URL abre direto, sem
 * rota nova no PHP (como a dos marcadores).
 */
import Extend from 'flarum/common/extenders';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const NotificationsUserPage = () => import('./NotificationsUserPage');

export default [
  new Extend.Routes() //
    .add('user.notifications', '/u/:username/notifications', NotificationsUserPage, UserPageResolver as any),
];
