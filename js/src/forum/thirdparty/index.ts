/*
 * Integração com extensões de terceiros (FriendsOfFlarum) que cobrem
 * recursos do Discourse: cada uma só é tocada se estiver ativa, e nenhum
 * módulo delas é importado direto — vêm do registro do Flarum, com guarda.
 * As chaves do admin (thirdparty/settings.ts) são lidas na hora de desenhar:
 * no initializer o fórum ainda não carregou as configurações.
 *
 * O resto (follow-tags, oauth, terms, formatting, split, merge, ignore) é só
 * visual, em less/forum/thirdparty/.
 *
 * forumaker/profile-cover não tem install: a capa é lida por
 * features/profile/data.ts com `thirdParty.profileCover()`, e o campo das
 * Configurações e o editor estão em ./profileCover.
 */
import installBestAnswer from './bestAnswer';
import installReactions from './reactions';
import installPolls from './polls';
import installLinks from './links';
import installUpload from './upload';
import installThumbnails from './thumbnails';
import installRealtime from './realtime';
import installRamonChat from './ramonChat';
import installVerified from './verified';
import installMarketplace from './marketplace';
import installRamonChatFeatures from './ramonChat/features';
import installWiki from './wiki';
import { isExtensionEnabled } from '../utils/settings';

export default function installThirdParty(): void {
  if (isExtensionEnabled('fof-best-answer')) installBestAnswer();
  if (isExtensionEnabled('fof-reactions')) installReactions();
  if (isExtensionEnabled('fof-polls')) installPolls();
  if (isExtensionEnabled('fof-links')) installLinks();
  if (isExtensionEnabled('fof-upload')) installUpload();
  if (isExtensionEnabled('fof-discussion-thumbnail')) installThumbnails();
  if (isExtensionEnabled('flarum-realtime')) installRealtime();
  if (isExtensionEnabled('ramon-chat')) installRamonChat();
  if (isExtensionEnabled('ramon-verified')) installVerified();
  if (isExtensionEnabled('linkrobins-wiki')) installWiki();
  if (isExtensionEnabled('ramon-marketplace')) installMarketplace();
  // Os recursos do chat do Discourse por cima do ramon/chat (ramonChat/features).
  if ('ramon-chat' in flarum.extensions) installRamonChatFeatures();
}
