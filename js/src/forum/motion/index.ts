/*
 * Movimento: barra de carregamento do topo, toasts, fechamento
 * dos menus, dicas dos botões de ícone, reticências de "digitando" e o
 * retorno de "link copiado". O que é só CSS (aberturas, destaques, spinner,
 * skeleton, foco) mora em `less/forum/Motion.less`.
 */
import installLoadingSlider from './loadingSlider';
import installToasts from './toasts';
import installMenus from './menus';
import installTooltips from './tooltips';
import installTyping from './typing';
import installFeedback from './feedback';

export { postActionFeedback } from './feedback';
export { startLoading, endLoading } from './loadingSlider';

export default function installMotion() {
  // As configurações só existem depois do boot (`app.forum`): cada módulo
  // as lê na hora de agir, nunca aqui.
  installLoadingSlider();

  installToasts();
  installMenus();
  installTooltips();
  installTyping();
  installFeedback();
}

export { installMotion };
