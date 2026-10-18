/*
 * Entrar e cadastrar em página própria (/login, /signup), como o Discourse.
 * Com a opção desligada (ou sem o extend/auth.php carregado, que dá as rotas
 * no servidor), Entrar e Cadastrar-se do cabeçalho continuam abrindo os
 * modais do core.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import AuthPage, { type AuthMode, goToAuth, rememberReturn } from './AuthPage';
import ResetPasswordPage from './ResetPasswordPage';
import { forumBool } from '../../utils/settings';

export function authPagesActive(): boolean {
  return forumBool('canelaAuthPages', true) && forumBool('canelaAuthRoutes', false);
}

export default function installAuth(): void {
  // A página tira o modo do nome da rota (o DefaultResolver não passa attrs).
  app.routes['canela.login'] = { path: '/login', component: AuthPage };
  app.routes['canela.signup'] = { path: '/signup', component: AuthPage };
  app.routes['canela.forgot'] = { path: '/forgot-password', component: AuthPage };
  // O link do e-mail de redefinição (o servidor dá a página: extend/auth.php).
  app.routes['resetPassword'] = { path: '/reset/:token', component: ResetPasswordPage };

  extend(HeaderSecondary.prototype, 'items', (items: ItemList<Mithril.Children>) => {
    if (app.session.user || !authPagesActive()) return;

    const link = (key: string, mode: AuthMode) => {
      const button = items.has(key) ? (items.get(key) as Mithril.Vnode<any>) : null;

      if (!button?.attrs) return;

      button.attrs.onclick = (event: MouseEvent) => {
        event.preventDefault();
        rememberReturn();
        goToAuth(mode);
      };
    };

    link('logIn', 'login');
    link('signUp', 'signup');
  });
}
