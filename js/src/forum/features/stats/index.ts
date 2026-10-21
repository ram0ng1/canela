/*
 * Estatísticas: visualizações, "Novos (N)"/"Não lidos (N)" e a
 * atividade do perfil. O back-end conta tudo (extend/stats.php); aqui ficam
 * a navegação que mostra as contagens e o registro do tempo de leitura.
 */
import installNavigation from './navigation';
import installReadTracker from './readTracker';

export { newCount, unreadCount, formatCount, refreshCounts } from './counts';
export { userActivity, formatReadTime, ACTIVITY_ATTRIBUTES } from './activity';

export function installStats(): void {
  installNavigation();
  installReadTracker();
}

export default installStats;
