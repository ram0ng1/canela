/*
 * A aba "Resolvido" do perfil: as respostas da
 * pessoa escolhidas como melhor resposta, pelo filtro `solution` do próprio
 * fof/best-answer. Os itens são os `user-stream-item` das outras abas.
 */
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';

import { leaveIfHidden } from './install';

export default class SolvedUserPage extends PostsUserPage {
  show(user: User): void {
    if (leaveIfHidden('solved', user)) return;

    super.show(user);
  }

  params(user: User) {
    return { filter: { author: user.slug(), solution: '1' } } as any;
  }
}
