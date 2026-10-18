/*
 * Perfil do usuário e menus da sessão no estilo do Discourse.
 *
 * - O cartão do perfil (UserCard `.UserHero`) ganha capa, avatar grande,
 *   nomes em destaque, grupos em pílulas, o botão "Mensagem" e a linha de
 *   estatísticas.
 * - A navegação do perfil vira abas horizontais abaixo do cartão.
 * - Uma página "Resumo" (`user.summary`) como a do Discourse.
 * - O menu da sessão abre com a identidade do usuário no topo.
 * - As subabas de "Atividade" do Discourse que faltavam (Lidos, Reações,
 *   Votos, Resolvido), em activity/.
 *
 * Os componentes gerais (botões, modais, composer, busca, configurações) são
 * só LESS: o markup do core já serve.
 */
import installProfile from './installProfile';
import installSummary from './installSummary';
import installSessionMenu from './installSessionMenu';
import installPreferences from './preferences/install';
import installActivity from './activity/install';

export default function installUser() {
  installProfile();
  installSummary();
  installSessionMenu();
  installPreferences();
  installActivity();
}
