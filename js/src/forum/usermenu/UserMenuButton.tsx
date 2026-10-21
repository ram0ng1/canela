/*
 * O avatar do cabeçalho, que abre o menu do usuário (`.header-dropdown-toggle
 * .current-user`). Ele herda o conteúdo do botão do menu da
 * sessão do core (`SessionDropdown.getButtonContent`), então o que outras
 * áreas põem ali — o emoji do status do perfil — continua aparecendo; só o
 * nome sai.
 *
 * A bolha, nesta ordem: o envelope verde para mensagens não lidas; a
 * bandeira vermelha para itens de revisão ainda não vistos; senão o número de tudo o
 * que espera no menu — as notificações não lidas (de qualquer aba, não só as
 * "novas") mais os itens pendentes da fila de revisão.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { userMenu } from './state';
import { umText } from './text';
import { loadMenu } from './lazy';
import { lazyComponent } from '../utils/lazy';
import { chatReviewCount } from '../thirdparty/ramonChat/features/flags';

// O menu aberto vem num chunk; o ponteiro ou o foco no avatar já o pede.
const UserMenu = lazyComponent(() => loadMenu().then((chunk) => chunk.UserMenu));
const preload = () => void loadMenu().catch(() => {});

export default class UserMenuButton extends Component {
  view() {
    // Ao navegar, o menu fecha. O cabeçalho
    // é redesenhado a cada troca de rota, então basta conferir aqui.
    if (userMenu.open && userMenu.route !== m.route.get()) userMenu.close();

    const user = app.session.user!;
    const unreadDialogs = user.attribute<number>('unreadDialogCount') || 0;
    const canReview = !!app.forum.attribute('canViewFlags') && !!(app as any).flags;
    // As denúncias abertas do chat (ramon/chat) também são itens a revisar.
    const chatReviewables = chatReviewCount();
    const newReviewables = (canReview ? Number(user.attribute<number>('newFlagCount') || 0) : 0) + chatReviewables;
    const pendingReviewables = (canReview ? Number(app.forum.attribute<number>('flagCount') || 0) : 0) + chatReviewables;
    const total = (user.unreadNotificationCount() || 0) + pendingReviewables;
    const label = umText('toggle');

    return (
      <div className={classList('CanelaUserMenuWrap', { 'CanelaUserMenuWrap--open': userMenu.open })}>
        <button
          type="button"
          className={classList('Button Button--flat CanelaUserMenuButton', { active: userMenu.open })}
          aria-haspopup="true"
          aria-expanded={userMenu.open ? 'true' : 'false'}
          aria-controls="canela-user-menu"
          aria-label={label}
          title={label}
          onmouseenter={preload}
          onfocus={preload}
          ontouchstart={preload}
          onclick={(e: MouseEvent) => {
            e.preventDefault();
            userMenu.toggle();
          }}
        >
          {this.avatarContent()}
          {unreadDialogs > 0 ? (
            <span
              className="CanelaUserMenuButton-badge CanelaUserMenuButton-badge--pms"
              title={umText('badge.new_messages', { count: unreadDialogs })}
            >
              <Icon name="fas fa-envelope" />
            </span>
          ) : newReviewables > 0 ? (
            <span
              className="CanelaUserMenuButton-badge CanelaUserMenuButton-badge--reviewables"
              title={umText('badge.new_reviewables', { count: newReviewables })}
            >
              <Icon name="fas fa-flag" />
            </span>
          ) : total > 0 ? (
            <span className="CanelaUserMenuButton-badge CanelaUserMenuButton-badge--unread" title={umText('badge.unread', { count: total })}>
              {total}
            </span>
          ) : null}
        </button>
        {userMenu.open ? <UserMenu /> : null}
      </div>
    );
  }

  /** O avatar (e o que se acrescenta a ele), sem o nome de usuário. */
  avatarContent(): Mithril.Children {
    const session: any = Object.create(SessionDropdown.prototype);
    session.attrs = {};

    const children = SessionDropdown.prototype.getButtonContent.call(session) as Mithril.Children[];

    return (Array.isArray(children) ? children : [children]).filter((child: any) => {
      if (typeof child === 'string') return false;
      if (child && child.attrs && typeof child.attrs.className === 'string' && child.attrs.className.includes('Button-label')) return false;

      return !!child;
    });
  }

  onupdate(vnode: Mithril.VnodeDOM<any, this>) {
    super.onupdate(vnode);

    // Fechado pelo Esc: o foco volta ao avatar.
    if (!userMenu.open && userMenu.restoreFocus) {
      userMenu.restoreFocus = false;
      (this.element.querySelector('.CanelaUserMenuButton') as HTMLElement | null)?.focus();
    }
  }
}
