/*
 * Extenders do fórum para os marcadores: o modelo no store, a rota da aba do
 * perfil, o componente da notificação de lembrete e os atributos que o PHP
 * acrescenta aos posts. O agente principal espalha este array no `extend` do
 * fórum.
 */
import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

import Bookmark from './Bookmark';
// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const BookmarksUserPage = () => import('./components/BookmarksUserPage');
import BookmarkReminderNotification from './components/BookmarkReminderNotification';

export default [
  new Extend.Store() //
    .add('canela-bookmarks', Bookmark),

  // O servidor já atende `/u/{username}[/{filter}]` com a página do perfil:
  // a URL abre direto, sem rota nova no PHP.
  // O cast: a tipagem do core 2.0.1 não aceita o UserPageResolver aqui, embora
  // o próprio flarum/likes o use do mesmo jeito.
  new Extend.Routes() //
    .add('canela.user.bookmarks', '/u/:username/bookmarks', BookmarksUserPage, UserPageResolver as any),

  new Extend.Notification() //
    .add('canelaBookmarkReminder', BookmarkReminderNotification),

  new Extend.Model(Post) //
    .attribute<boolean>('bookmarked')
    .attribute<number | null>('bookmarkId')
    .attribute<string | null>('bookmarkName')
    .attribute<Date | null, string | null>('bookmarkReminderAt', (value) => (value ? new Date(value) : null)),
];
