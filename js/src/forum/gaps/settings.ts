/*
 * As chaves liga/desliga dos recursos do Discourse que faltavam (gaps).
 *
 * Lidas na hora de usar, e não no initializer: lá o fórum ainda não carregou
 * as configurações. Os recursos com backend (extend/gaps.php) só aparecem
 * quando o servidor diz que o backend está carregado (`canelaGapsBackend`):
 * sem ele, a interface chamaria rotas que não existem.
 */
import app from 'flarum/forum/app';

import { forumBool } from '../utils/settings';

export const gaps = {
  postShortcuts: () => forumBool('canelaPostShortcuts', true) && forumBool('canelaKeyboardShortcuts', true),
  lightbox: () => forumBool('canelaLightbox', true),
  codeButtons: () => forumBool('canelaCodeButtons', true),
  headingAnchors: () => forumBool('canelaHeadingAnchors', true),
  spoilerBlur: () => forumBool('canelaSpoilerBlur', true),
  mentionCards: () => forumBool('canelaMentionCards', true) && forumBool('canelaUserCard', true),
  readState: () => forumBool('canelaPostReadState', true),
  timelineBack: () => forumBool('canelaTimelineBack', true) && forumBool('canelaTopicTimeline', true),
  titleEditor: () => forumBool('canelaInlineTitleEditor', true),
  shareModal: () => forumBool('canelaShareModal', true),
  lastVisit: () => forumBool('canelaListLastVisit', true),
  dismiss: () => forumBool('canelaListDismiss', true),
  tableExpand: () => forumBool('canelaTableExpand', true),
};

/** Os recursos com backend: só com o extend/gaps.php carregado. */
export function gapsBackend(): boolean {
  return forumBool('canelaGapsBackend', false);
}

export function gapsBackendOn(attribute: string): boolean {
  return gapsBackend() && forumBool(attribute, true);
}

/** O texto de uma configuração de texto livre, já sem espaços nas pontas. */
export function forumString(attribute: string): string {
  const value = app.forum.attribute<unknown>(attribute);

  return typeof value === 'string' ? value.trim() : '';
}
