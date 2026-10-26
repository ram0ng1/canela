import Extend from 'flarum/common/extenders';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

import Badge from './models/Badge';
import UserBadge from './models/UserBadge';
// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const BadgesPage = () => import('./components/BadgesPage');
const BadgePage = () => import('./components/BadgePage');
const UserBadgesPage = () => import('./components/UserBadgesPage');
import BadgeGrantedNotification from './components/BadgeGrantedNotification';

/*
 * As rotas existem sempre: os extenders rodam antes de o fórum saber das
 * configurações. Com os emblemas desligados o servidor responde 404 a quem
 * chega pelo endereço, os links somem e as páginas mostram só um aviso.
 *
 * `trustLevel` é lido com `user.attribute('trustLevel')` em ./utils, e não
 * declarado no modelo, para não colidir com outra extensão que o declare.
 */
export default [
  new Extend.Store() //
    .add('canela-badges', Badge)
    .add('canela-user-badges', UserBadge),

  new Extend.Routes()
    .add('canela.badges', '/badges', BadgesPage)
    .add('canela.badge', '/badges/:id/:slug', BadgePage)
    // O servidor aceita o endereço sem o slug; o roteador precisa da rota também.
    .add('canela.badge.short', '/badges/:id', BadgePage)
    .add('canela.user.badges', '/u/:username/badges', UserBadgesPage, UserPageResolver),

  new Extend.Notification() //
    .add('canelaBadgeGranted', BadgeGrantedNotification),
];
