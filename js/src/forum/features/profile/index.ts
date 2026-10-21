/*
 * Perfil estendido (campos extras de perfil): bio, local, site,
 * título, status com emoji, capa, fundo do cartão e aniversário.
 *
 * - Configurações → seção "Perfil" para editar os próprios campos.
 * - UserCard do core (hero do perfil): título, status, bio, local/site/
 *   aniversário e as imagens como variáveis CSS.
 * - Posts: o emoji do status ao lado do nome e o título no cabeçalho.
 * - Cabeçalho: o emoji em selo sobre o avatar da sessão.
 * - "Editar usuário" (moderação): textos e limpeza de status e imagens.
 *
 * As outras áreas que desenham perfis próprios (o cartão do tópico) usam as
 * peças de ./components e os dados de ./data, que já respeitam o admin.
 */
import { installEditUserModal, installPostUser, installSessionStatus, installUserCard } from './integrations';
import installSettingsPage from './settingsPage';

export function installExtendedProfile() {
  installSettingsPage();
  installUserCard();
  installPostUser();
  installSessionStatus();
  installEditUserModal();
}

export default installExtendedProfile;

export * from './data';
export { Bio, BirthdayFact, LocationFact, ProfileCardExtras, StatusEmoji, StatusLine, TitleLine, WebsiteFact, profileImageStyle } from './components';
