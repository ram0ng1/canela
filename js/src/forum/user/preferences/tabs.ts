/*
 * As abas das preferências, como as do Discourse (Conta, Segurança, Perfil,
 * Notificações, Acompanhamento, Usuários, Interface, Menu de navegação,
 * Chat). Cada aba é um endereço próprio, `/u/:username/preferences/:tab`.
 *
 * As seções continuam vindo do `settingsItems` do SettingsPage (core e
 * extensões); aqui só se decide em que aba cada uma aparece. Uma seção que
 * nenhuma tabela conhece vai para "Outros", para nunca sumir.
 *
 * Duas abas são páginas de outro dono: "Segurança" é o UserSecurityPage do
 * core e "Usuários" é a lista de ignorados do fof/ignore-users.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { isExtensionEnabled } from '../../utils/settings';
import { isTagsEnabled } from '../../utils/tags';
import { canEditProfile, profileEnabled } from '../../features/profile/data';
import { caps } from '../../features/chat/flags';
import { ramonChatPreferencesOn } from '../../thirdparty/ramonChat/features/flags';

export type PrefTab =
  'account' | 'security' | 'profile' | 'notifications' | 'tracking' | 'users' | 'interface' | 'navigation-menu' | 'chat' | 'other';

export const TAB_ROUTE = 'user.preferences.tab';
export const BASE_ROUTE = 'user.preferences';

/** Ícones das abas, os mesmos do `user-navigation-secondary` do Discourse. */
export const TAB_ICONS: Record<PrefTab, string> = {
  account: 'fas fa-circle-user',
  security: 'fas fa-lock',
  profile: 'fas fa-address-card',
  notifications: 'fas fa-bell',
  tracking: 'fas fa-plus',
  users: 'fas fa-users',
  interface: 'fas fa-desktop',
  'navigation-menu': 'fas fa-bars',
  chat: 'fas fa-comment',
  other: 'fas fa-puzzle-piece',
};

/** Seções conhecidas (chaves do `settingsItems`) e a aba de cada uma. */
const SECTION_TABS: Record<string, PrefTab> = {
  account: 'account',
  privacy: 'account',
  canelaProfile: 'profile',
  notifications: 'notifications',
  canelaAutoTrack: 'tracking',
  'fof-follow-tags': 'tracking',
  canelaInterface: 'interface',
  wardrobeTheme: 'interface',
  colorScheme: 'interface',
  device: 'interface',
  realtimeItems: 'interface',
  drafts: 'interface',
  canelaNavMenu: 'navigation-menu',
  canelaChat: 'chat',
  // A seção do ramon/chat (thirdparty/ramonChat/features/preferences.tsx).
  canelaRamonChat: 'chat',
};

/** Itens do `notificationsItems` que, no Discourse, são do "Acompanhamento". */
export const TRACKING_ITEMS = ['followAfterReply', 'followAfterCreate', 'notifyForAllPosts'];

export function sectionTab(key: string): PrefTab {
  return SECTION_TABS[key] || 'other';
}

/** Lembra se a última página de Configurações tinha seções em "Outros". */
let hasOther = false;

export function rememberOther(value: boolean): void {
  hasOther = value;
}

/** As abas que este usuário tem, na ordem do Discourse. */
export function visibleTabs(user: User): PrefTab[] {
  const tabs: PrefTab[] = ['account', 'security'];

  if (profileEnabled() && canEditProfile(user)) tabs.push('profile');
  tabs.push('notifications');
  if (isExtensionEnabled('flarum-subscriptions') || isExtensionEnabled('fof-follow-tags')) tabs.push('tracking');
  if (app.routes['user.ignoredUsers']) tabs.push('users');
  tabs.push('interface');
  if (isTagsEnabled()) tabs.push('navigation-menu');
  if ((caps().enabled && caps().allowed) || ramonChatPreferencesOn()) tabs.push('chat');
  if (hasOther) tabs.push('other');

  return tabs;
}

export function tabUrl(user: User, tab: PrefTab): string {
  if (tab === 'security') return app.route('user.security', { username: user.slug() });
  if (tab === 'users') return app.route('user.ignoredUsers');

  return app.route(TAB_ROUTE, { username: user.slug(), tab });
}

/** A aba aberta agora, ou null fora das preferências. */
export function currentTab(): PrefTab | null {
  const route = app.current.get('routeName');

  if (route === 'user.security') return 'security';
  if (route === 'user.ignoredUsers') return 'users';
  if (route === 'settings' || route === BASE_ROUTE) return 'account';
  if (route === TAB_ROUTE) return (m.route.param('tab') as PrefTab) || 'account';

  return null;
}
