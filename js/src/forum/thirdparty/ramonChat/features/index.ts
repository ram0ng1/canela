/*
 * Os recursos que o chat próprio do tema tinha e o
 * ramon/chat não tem, postos por cima dele sem editar a extensão (o backend
 * mora em extend/ramonchat.php). Cada um tem a sua chave no admin (card
 * "Recursos extras do chat"), lida na hora de desenhar.
 *
 * Só é instalado com `ramon-chat` em `flarum.extensions` (thirdparty/index.ts):
 * os extends usam o nome dos módulos dele, e sem a extensão nada é tocado.
 *
 * Ganchos para o resto do tema:
 * - `openNewMessage()` (newMessage.ts): a "Nova mensagem" — o "+" das MDs na
 *   barra lateral o recebe por `sidebarHooks.newMessage`;
 * - `starredIds()` (starred.tsx): os canais favoritos, que a barra põe no topo
 *   (`sidebarHooks.sortChannels`) com a estrela (`sidebarHooks.channelSuffix`).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';

import { registerSidebarHooks, sidebarHooks } from '../hooks';
import installRamonChatPreferences, { applySoundPreference } from './preferences';
import installHeaderIndicator from './headerIndicator';
import installMessageActions from './messageActions';
import installDrawerShortcut from './shortcut';
import installRamonChatNotifications from './notifications';
import installChannelView from './channelView';
import installPins from './pins';
import installChannelInfo from './channelInfo';
import installComposer from './composer';
import installPermalink from './permalink';
import { canStartNewMessage, openNewMessage } from './newMessage';
import { sortStarred, starSuffix } from './starred';

export { openNewMessage } from './newMessage';
export { starredIds } from './starred';

let installed = false;

export default function installRamonChatFeatures(): void {
  if (installed) return;
  installed = true;

  installRamonChatPreferences();
  installHeaderIndicator();
  installMessageActions();
  installDrawerShortcut();
  installRamonChatNotifications();
  installChannelView();
  installPins();
  installChannelInfo();
  installComposer();
  installPermalink();

  // A barra lateral do tema (thirdparty/ramonChat/sidebar.tsx).
  registerSidebarHooks({
    sortChannels: (channels) => sortStarred(channels),
    channelSuffix: (channel) => starSuffix(channel),
  });

  // O "+" só existe quando a "Nova mensagem" vale para o leitor (lido a cada desenho).
  Object.defineProperty(sidebarHooks, 'newMessage', {
    configurable: true,
    enumerable: true,
    get: () => (canStartNewMessage() ? openNewMessage : undefined),
    set: () => {},
  });

  // O "Nenhum" do som (ver applySoundPreference), já no boot.
  extend(app as any, 'mount', () => applySoundPreference());
}
