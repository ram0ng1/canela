/*
 * A aba "Lidos" do perfil: os tópicos que a pessoa leu, do mais recente para
 * o mais antigo (`filter[canelaReadBy]`, de extend/activity.php), na lista de
 * tópicos de sempre. Só a própria pessoa e administradores a veem; o
 * servidor confere de novo.
 */
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { leaveIfHidden } from './install';

export default class ReadUserPage extends UserPage<IUserPageAttrs, DiscussionListState> {
  oninit(vnode: Mithril.Vnode<IUserPageAttrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    if (leaveIfHidden('read', user)) return;

    super.show(user);

    this.state = new DiscussionListState({ filter: { canelaReadBy: user.slug() } } as any);
    this.state.refresh();
  }

  content() {
    return <div className="DiscussionsUserPage CanelaReadUserPage">{this.state && <DiscussionList state={this.state} />}</div>;
  }
}
