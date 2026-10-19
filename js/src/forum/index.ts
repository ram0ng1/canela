import app from 'flarum/forum/app';
import normalizeRevManifest from '../common/revManifest';

import installIcons from './icons';
import installPreload from './utils/preload';
import installShell from './shell/installShell';
import installList from './list';
import installUser from './user';
import installTopic from './topic';
import installCommunity from './features/community';
import installStats from './features/stats';
import installLinks from './features/links';
import installMeToo from './features/metoo';
import installBookmarks from './features/bookmarks';
import installComposer from './features/composer';
import installExtras from './features/extras';
import installExtendedProfile from './features/profile';
import installBadges from './features/badges';
import installAi from './features/ai';
import installChat from './features/chat';
import installMessages from './features/messages';
import installUserMenu from './usermenu';
import installReview from './review';
import installComposerShell from './composer/installComposerShell';
import installGaps from './gaps';
import installMotion from './motion';
import installThirdParty from './thirdparty';
import installSearchMenu from './search';
import installAuth from './features/auth';
import installActionTooltips from './topic/actionTooltips';

import communityExtend from './features/community/extend';
import bookmarksExtend from './features/bookmarks/extend';
import extrasExtend from './features/extras/extend';
import badgesExtend from './features/badges/extend';
import aiExtend from './features/ai/extend';
import chatExtend from './features/chat/extend';
import messagesExtend from './features/messages/extend';
import gapsExtend from './gaps/extend';
import userMenuExtend from './usermenu/extend';

// Modelos e rotas dos recursos com backend. Cada recurso decide sozinho se
// aparece (pela configuração que o servidor serializa), então registrar as
// rotas sempre não tem efeito colateral.
export const extend = [
  ...communityExtend,
  ...bookmarksExtend,
  ...extrasExtend,
  ...badgesExtend,
  ...aiExtend,
  ...chatExtend,
  ...messagesExtend,
  ...gapsExtend,
  ...userMenuExtend,
];

app.initializers.add('ramon-canela', () => {
  // Antes de qualquer chunk: as chaves das revisões no Windows (ver o arquivo).
  normalizeRevManifest();
  // Antes de tudo: as páginas que pedem dados no boot já encontram a resposta pronta.
  installPreload();
  installIcons();
  // Tema base: casca, lista, perfil e tópico.
  installShell();
  installList();
  installUser();
  installTopic();

  // Recursos com backend. A ordem importa onde um estende o outro: a
  // comunidade substitui um item do perfil, e as estatísticas estendem a
  // navegação da lista e a barra lateral.
  installExtendedProfile();
  installCommunity();
  installStats();
  installLinks();
  installMeToo();
  installBookmarks();
  installComposer();
  installComposerShell();
  installExtras();
  installBadges();
  installAi();
  installChat();
  installMessages();
  installUserMenu();
  // A fila de revisão do Discourse na página /flags (flarum/flags e approval).
  installReview();

  // Recursos e comportamentos do Discourse que faltavam (gaps/).
  installGaps();

  // Animações, toasts, dicas e carregamento do Discourse (motion/).
  installMotion();

  // Extensões de terceiros (FoF) no visual do Discourse (thirdparty/).
  installThirdParty();

  // O menu de busca do Discourse no cabeçalho e no banner (search/).
  installSearchMenu();

  // Entrar e cadastrar em página própria (/login, /signup).
  installAuth();

  // Dicas nos botões só de ícone da barra de ações do post: por último, para
  // enxergar os botões de todos os recursos e extensões.
  installActionTooltips();
});
