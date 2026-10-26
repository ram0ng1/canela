/*
 * Entrar e cadastrar em página própria (/login, /signup).
 * Com a opção desligada (ou sem o extend/auth.php carregado, que dá as rotas
 * no servidor), Entrar e Cadastrar-se do cabeçalho continuam abrindo os
 * modais do core.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Modal from 'flarum/common/components/Modal';
import ModalManagerState from 'flarum/common/states/ModalManagerState';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { type AuthMode, goToAuth, rememberReturn } from './AuthPage';
import { forumBool } from '../../utils/settings';

export function authPagesActive(): boolean {
  return forumBool('canelaAuthPages', true) && forumBool('canelaAuthRoutes', false);
}

export default function installAuth(): void {
  // As rotas ficam em ./extend.ts.
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

  installModalRedirect();
}

/**
 * Os modais de entrar e de cadastro abertos de qualquer lugar (responder,
 * curtir, seguir, o "Entrar" da barra, o fim do login social…) viram as
 * páginas, com a opção ligada. Os atributos vão junto: o login social, por
 * exemplo, abre o cadastro já com o token e os campos preenchidos.
 *
 * O core abre esses modais sob demanda (`() => import(...)`): só dá para
 * saber qual é depois de carregar, e aí o modal carregado segue normal.
 */
function installModalRedirect(): void {
  override(ModalManagerState.prototype, 'show', async function (this: any, original: any, component: any, attrs: any = {}, stack = false) {
    if (!authPagesActive() || !forumBool('canelaAuthPagesModals', true) || app.session.user) {
      return original(component, attrs, stack);
    }

    let resolved = component;

    if (typeof component === 'function' && !(component.prototype instanceof Modal)) {
      resolved = ((await component()) as any).default;
    }

    const mode = modalMode(resolved);

    if (!mode) return original(resolved, attrs, stack);

    rememberReturn();
    goToAuth(mode, attrs || {});
  });
}

function modalMode(component: any): AuthMode | null {
  const get = (name: string) => (flarum as any).reg.get('core', `forum/components/${name}`);
  const is = (Base: any) => !!Base && (component === Base || component?.prototype instanceof Base);

  if (is(get('SignUpModal'))) return 'signup';
  if (is(get('LogInModal'))) return 'login';

  return null;
}
