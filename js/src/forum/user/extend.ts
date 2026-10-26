/*
 * Rotas do perfil: Resumo, Atividade, as subabas de atividade e as
 * preferências em abas. O servidor já atende `/u/{username}[/{filter}]` com a
 * página do perfil, então as URLs abrem direto, sem rota nova no PHP.
 */
import Extend from 'flarum/common/extenders';
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

import { TABS, type Tab } from './activity/install';
import { PreferencesPage, PreferencesResolver } from './preferences/install';
import { BASE_ROUTE, TAB_ROUTE } from './preferences/tabs';

// A página do Resumo desce só quando alguém abre a aba (chunk próprio).
const UserSummaryPage = () => import('./UserSummaryPage');

const routes = new Extend.Routes()
  .add('user.summary', '/u/:username/summary', UserSummaryPage, UserPageResolver)
  // As postagens ganham um endereço próprio: o `/u/:username` do core vira a
  // porta de entrada e abre no Resumo.
  .add('user.activity', '/u/:username/activity', PostsUserPage, UserPageResolver)
  .add(BASE_ROUTE, '/u/:username/preferences', PreferencesPage, PreferencesResolver)
  .add(TAB_ROUTE, '/u/:username/preferences/:tab', PreferencesPage, PreferencesResolver);

// Lidos, Reações, Votos e Resolvido (activity/install.tsx).
(Object.keys(TABS) as Tab[]).forEach((tab) => routes.add(`user.${tab}`, `/u/:username/${tab}`, TABS[tab].load, UserPageResolver));

export default [routes];
