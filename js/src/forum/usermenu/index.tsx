/*
 * O menu do usuário no lugar do sino e do menu da sessão.
 *
 * - O cabeçalho perde o sino (NotificationsDropdown), os posts sinalizados
 *   (FlagsDropdown, do flarum/flags) e o envelope (DialogsDropdown, do
 *   flarum/messages): tudo isso vira aba do menu. O menu
 *   da sessão (SessionDropdown) vira o avatar que abre o menu — os itens dele
 *   continuam, na aba Perfil.
 * - Esc e clique fora fecham; navegar também.
 * - A página /notifications ganha a mesma lista, com as abas em linha.
 *
 * Desligável no admin (`canela.user_menu`): desligado, o cabeçalho volta ao
 * do core.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import LinkButton from 'flarum/common/components/LinkButton';
import UserPage from 'flarum/forum/components/UserPage';
import PageStructure from 'flarum/forum/components/PageStructure';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import UserMenuButton from './UserMenuButton';
import { userMenu } from './state';
import { umText } from './text';
import { loadMenu } from './lazy';
import { beforeChunk } from '../utils/chunkGate';
import { forumBool } from '../utils/settings';

// O menu aberto e os painéis moram num chunk (lazy.ts); quem quiser
// estendê-los usa o nome do módulo (`ext:ramon/canela/forum/usermenu/UserMenu`).
export { userMenu };
export type { UserMenuTab } from './UserMenu';
export { menuIcon } from './icons';

export function userMenuEnabled(): boolean {
  return !!app.session.user && forumBool('canelaUserMenu', true);
}

/** Os itens do cabeçalho que o menu absorve. */
const ABSORBED_HEADER_ITEMS = ['notifications', 'flags', 'messages'];

export default function installUserMenu(): void {
  // Registrado no `mount`, antes do primeiro desenho: os initializers de
  // extensões que vêm depois do tema (o flarum/messages, por exemplo) já
  // acrescentaram os itens deles, e a remoção precisa rodar por último.
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (!userMenuEnabled()) return;

      ABSORBED_HEADER_ITEMS.forEach((key) => items.has(key) && items.remove(key));

      // A mesma chave (`session`) e prioridade do menu da sessão: a ordem dos
      // ícones do cabeçalho, no celular também, já conta com ela.
      if (items.has('session')) items.setContent('session', <UserMenuButton />);
    });

    return original(...args);
  });

  installGlobalListeners();
  installNotificationsPage();
  installProfileTab();
}

/**
 * "Notificações" entre as abas de primeiro nível do perfil (só no próprio
 * perfil). A chave `notifications` já está entre as que o
 * perfil do tema põe na primeira linha.
 */
function installProfileTab(): void {
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    const user = this.user;

    if (!user || app.session.user !== user || !app.routes['user.notifications']) return;

    items.add(
      'notifications',
      <LinkButton href={app.route('user.notifications', { username: user.slug() })} icon="far fa-bell">
        {umText('page.title')}
      </LinkButton>,
      95
    );
  });
}

function installGlobalListeners(): void {
  // Clique fora fecha. Na captura, antes de outros ouvintes pararem o evento;
  // o clique no próprio avatar fica com o botão (que alterna).
  document.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      if (!userMenu.open) return;

      const target = e.target as HTMLElement | null;

      if (target?.closest?.('.CanelaUserMenuWrap')) return;

      userMenu.close();
      m.redraw();
    },
    true
  );

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!userMenu.open || e.key !== 'Escape') return;

    // Um modal aberto por cima (ex.: a confirmação de sair) fica com o Esc.
    if (document.body.classList.contains('modal-open')) return;

    e.preventDefault();
    userMenu.close(true);
    m.redraw();
  });

  // O foco saindo do menu pelo Tab também fecha, como um menu suspenso.
  document.addEventListener('focusin', (e: FocusEvent) => {
    if (!userMenu.open) return;

    const target = e.target as HTMLElement | null;

    if (target && target !== document.body && !target.closest('.CanelaUserMenuWrap') && !target.closest('.ModalManager')) {
      userMenu.close();
      m.redraw();
    }
  });
}

/**
 * A página /notifications (carregada sob demanda: pelo nome do módulo). O
 * `oninit` do core continua: ele carrega a lista e põe o título.
 */
function installNotificationsPage(): void {
  // O chunk do menu (com a lista) desce junto com o da página do core.
  let NotificationsPageView: (() => Mithril.Children) | null = null;

  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/NotificationsPage\.js/.test(url),
    () =>
      loadMenu().then((chunk) => {
        NotificationsPageView = chunk.NotificationsPageView;
      })
  );

  override('flarum/forum/components/NotificationsPage' as any, 'view', function (this: any, original: () => Mithril.Children) {
    if (!userMenuEnabled()) return original();

    return (
      <PageStructure className="NotificationsPage CanelaNotificationsPage">
        <div className="CanelaNotificationsPage-header">
          <h2 className="CanelaNotificationsPage-title">{umText('page.title')}</h2>
        </div>
        {NotificationsPageView ? NotificationsPageView() : null}
      </PageStructure>
    );
  });
}
