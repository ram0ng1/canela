/*
 * O painel do tema (abas, cards, busca): um chunk sob demanda, que só desce
 * quando a página da extensão abre. A busca do painel procura nos cards daqui,
 * então continua igual.
 */
import { createPanel } from './components/SettingsPanel';
import type { CardDef } from './types';
import CORE_CARDS from './cards/core';
import FEATURE_CARDS from './features';

const ORDER: string[] = [
  // Aparência
  'colors',
  'font',
  'surfaces',
  'colored-accents',
  'pill-buttons',
  'lucide-icons',
  'logo-title',
  'text-size',
  'announcement',
  'loading-slider',
  'loader',
  'toast-auto-close',
  // Cabeçalho e barra lateral
  'header-search',
  'user-menu',
  'auth-pages',
  'shortcuts',
  'sidebar',
  'sidebar-home',
  'sidebar-tags',
  'sidebar-links',
  // Lista
  'welcome-banner',
  'category-hero',
  'list-tabs',
  'list-filters',
  'list-columns',
  'views',
  'counts',
  'list-visit',
  'top-periods',
  'infinite-scroll',
  'categories-page',
  // Tópico
  'post-style',
  'reply-to-style',
  'post-actions',
  'embedded-replies',
  'post-content',
  'reading',
  'topic-timeline',
  'topic-map',
  'link-clicks',
  'topic-footer',
  'suggested',
  'new-replies-bar',
  'inline-title',
  'share',
  'bookmarks',
  'metoo',
  'local-dates',
  'print',
  'event-posts',
  // Editor e busca
  'composer',
  'drafts',
  'hashtags',
  'search-page',
  // Perfil e usuários
  'user-page',
  'user-card',
  'profile-fields',
  'profile-title',
  'profile-status',
  'profile-cover',
  'activity',
  // Mensagens e chat
  'messages',
  'chat',
  'chat-channels',
  'chat-dm',
  'chat-limits',
  // Comunidade
  'about',
  'guidelines',
  'about_pages',
  'legal',
  'directory',
  'groups',
  'badges',
  'badge-manager',
  'trust-levels',
  'invites',
  'not-found',
  // Moderação
  'bulk-select',
  'post-history',
  'author-notifications',
  // Mensagens automáticas
  'system-user',
  'sysmsg-welcome_user',
  'sysmsg-welcome_invite',
  'sysmsg-welcome_tl1_user',
  'sysmsg-tl2_promotion_message',
  'sysmsg-welcome_staff',
  'sysmsg-user_added_to_group_as_member',
  'sysmsg-flags_agreed_and_post_deleted',
  'sysmsg-silenced_by_staff',
  'sysmsg-unsilenced',
  // IA
  'ai-provider',
  'ai-bot',
  'ai-personas',
  'ai-helper',
  'ai-summary',
  'ai-gists',
  'ai-related',
  'ai-access',
];

const rank = (card: CardDef) => {
  const index = ORDER.indexOf(card.id);

  return index === -1 ? ORDER.length : index;
};

const CARDS: CardDef[] = [...CORE_CARDS, ...FEATURE_CARDS].sort((a, b) => rank(a) - rank(b));

export default createPanel(CARDS);
