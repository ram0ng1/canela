/*
 * A aba "Notificações" do perfil (`/u/:username/notifications`): a mesma
 * lista e as mesmas abas da página /notifications (todas,
 * respostas, curtidas, chat, outras), dentro do perfil. Só no próprio perfil:
 * a API só devolve as notificações de quem pede.
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import NotificationsPageView from './NotificationsPageView';
import { umText } from './text';

export default class NotificationsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--notifications';
    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (this.isOwnProfile()) Promise.resolve(app.notifications.load()).catch(() => {});
  }

  isOwnProfile(): boolean {
    return !!this.user && app.session.user === this.user;
  }

  content(): Mithril.Children {
    if (!this.isOwnProfile()) return <p className="CanelaNotificationsPage-private">{umText('page.private')}</p>;

    const slug = this.user!.slug();

    return (
      <div className="NotificationsPage CanelaNotificationsPage CanelaNotificationsPage--profile">
        {NotificationsPageView((filter) => app.route('user.notifications', filter ? { username: slug, filter } : { username: slug }))}
      </div>
    );
  }
}
