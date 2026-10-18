/*
 * A aba "Votos" do perfil: as postagens com enquetes do fof/polls em que a
 * pessoa votou (`filter[canelaVoter]`, de extend/activity.php). O servidor
 * só devolve as enquetes que mostram os votantes, ou todas para a própria
 * pessoa.
 */
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';

import { leaveIfHidden } from './install';

export default class VotesUserPage extends PostsUserPage {
  show(user: User): void {
    if (leaveIfHidden('votes', user)) return;

    super.show(user);
  }

  params(user: User) {
    return { filter: { canelaVoter: user.slug() } } as any;
  }
}
