/*
 * O conteúdo do chunk do menu do usuário (ver lazy.ts). A aba "Notificações"
 * do perfil vem junto: ela usa a mesma lista do menu, e num chunk próprio a
 * lista (e os painéis) ia duplicada nos dois.
 */
import UserMenu from './UserMenu';
import NotificationsPageView from './NotificationsPageView';
import NotificationsUserPage from './NotificationsUserPage';

export default { UserMenu, NotificationsPageView, NotificationsUserPage };
