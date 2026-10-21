/*
 * O "voltar" enquanto o tópico carrega.
 *
 * O core só põe o tópico na pilha do app.history no show(), quando a API
 * responde. Até lá o topo da pilha ainda é a página de onde se veio (/tags,
 * /categories, /badges, a lista de uma tag...), e voltar tirava justamente
 * ela: o botão apontava para a inicial e o clique (ou o atalho) levava para
 * lá. A entrada do tópico entra já no oninit; o show() depois só a atualiza
 * com o título de verdade (mesmo nome, mesma entrada).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import type Discussion from 'flarum/common/models/Discussion';

/** O tópico da rota, se já estiver no store (veio da lista, por exemplo). */
function knownDiscussion(): Discussion | undefined {
  const param = m.route.param('id');

  if (!param) return undefined;

  return app.store.all<Discussion>('discussions').find((discussion) => discussion.slug() === param || discussion.id() === param);
}

export default function installBackHistory(): void {
  extend(DiscussionPage.prototype, 'oninit', function () {
    app.history.push('discussion', knownDiscussion()?.title() || document.title);
  });
}
