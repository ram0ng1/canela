/*
 * Grava o responsável do tópico. Pelo PATCH direto, e não pelo
 * `discussion.save()`: o `Model.save` do core descarta uma relação null, e aí
 * "Remover atribuição" não removia nada.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';

export default function saveAssignee(discussion: Discussion, user: User | null): Promise<unknown> {
  return app
    .request({
      method: 'PATCH',
      url: `${app.forum.attribute('apiUrl')}/discussions/${discussion.id()}`,
      body: {
        data: {
          type: 'discussions',
          id: discussion.id(),
          relationships: { canelaAssignee: { data: user ? { type: 'users', id: user.id() } : null } },
        },
      },
    })
    .then((payload: any) => {
      app.store.pushPayload(payload);
      m.redraw();
    });
}
