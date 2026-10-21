/*
 * Recursos e comportamentos que faltavam no tema (gaps):
 * lightbox, botões dos blocos de código, âncoras dos títulos, tabelas
 * expansíveis, spoilers borrados, cartão nas menções, atalhos dos posts,
 * leitura (pontinho e "último acesso"), "Voltar" na linha do tempo, título
 * editável no cabeçalho, janela de compartilhar, "último acesso" e
 * "Descartar" na lista, e links novos na barra lateral.
 *
 * Cada recurso confere a própria configuração na hora de agir, então todos
 * são instalados sempre e somem sozinhos quando desligados no admin.
 */
import app from 'flarum/forum/app';

import installLightbox from './cooked/lightbox';
import installCookedDecorators from './cooked/decorate';
import installMentionCards from './cooked/mentions';
import installGapShortcuts from './shortcuts';
import installReadState from './topic/readState';
import installTimelineBack from './topic/timelineBack';
import installTitleEditor from './topic/titleEditor';
import installLastVisit from './list/lastVisit';
import installDismiss from './list/dismiss';
import installSidebarGaps from './sidebar';
import installSidebarHome from './sidebarHome';
import installCategoryNotifications from './integrations/categoryNotifications';
import installGapNotifications from './backend/notifications';
import installInvites from './backend/invites';

export { openShare } from './topic/share';

export function installGaps(): void {
  installLightbox();
  installMentionCards();
  installGapShortcuts();
  installLastVisit();
  installGapNotifications();
  installInvites();

  // Como o tópico do tema, no beforeMount: os extends registrados por último
  // rodam por último e enxergam o que as outras extensões e áreas puseram.
  app.beforeMount(() => {
    installCookedDecorators();
    installReadState();
    installTimelineBack();
    installTitleEditor();
    installDismiss();
    installSidebarGaps();
    installSidebarHome();
    installCategoryNotifications();
  });
}

export default installGaps;
