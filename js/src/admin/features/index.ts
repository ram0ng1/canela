/*
 * Cards dos recursos com backend e das integrações. Cada recurso exporta os
 * seus de ./features/<recurso>.tsx e entra nesta lista; o painel os separa
 * pelo `group` de cada card.
 */
import type { CardDef } from '../types';
import COMMUNITY_CARDS from './community';
import STATS_CARDS from './stats';
import BOOKMARKS_CARDS from './bookmarks';
import COMPOSER_CARDS from './composer';
import EXTRAS_CARDS from './extras';
import PROFILE_CARDS from './profile';
import BADGES_CARDS from './badges';
import AI_CARDS from './ai';
import CHAT_CARDS from './chat';
import GAPS_CARDS from './gaps';
import METOO_CARDS from './metoo';
import INTEGRATION_CARDS from './integrations';
import RAMON_CHAT_FEATURE_CARDS from './ramonChatFeatures';
import SYSTEM_CARDS from './system';
import EVENTS_CARDS from './events';
import BUG_REPORT_CARDS from './bugreports';
import TEMPLATE_CARDS from './templates';

const FEATURE_CARDS: CardDef[] = [
  ...COMMUNITY_CARDS,
  ...STATS_CARDS,
  ...BOOKMARKS_CARDS,
  ...EVENTS_CARDS,
  ...METOO_CARDS,
  ...COMPOSER_CARDS,
  ...EXTRAS_CARDS,
  ...PROFILE_CARDS,
  ...BADGES_CARDS,
  ...AI_CARDS,
  ...INTEGRATION_CARDS,
  ...RAMON_CHAT_FEATURE_CARDS,
  ...CHAT_CARDS,
  ...GAPS_CARDS,
  ...SYSTEM_CARDS,
  ...BUG_REPORT_CARDS,
  ...TEMPLATE_CARDS,
];

export default FEATURE_CARDS;
