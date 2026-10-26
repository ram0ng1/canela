/*
 * Rota e aba do "Resumo" do perfil (`/u/:username/summary`).
 *
 * As rotas `user.summary` e `user.activity` ficam em ./extend.ts
 * (Extend.Routes). O servidor já atende `/u/{username}[/{filter}]` com a
 * página do perfil, então a URL abre direto, sem rota nova no PHP.
 *
 * Os links de perfil (`app.route.user`: avatar, nome nos posts, menu da
 * sessão) abrem na aba escolhida no admin (`canela.user_default_tab`): a
 * atividade, como no Flarum (padrão), ou o Resumo.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';

export default function installSummary() {
  // A configuração é lida na hora de montar o link: no initializer o
  // `app.forum` ainda não existe. Fica aqui, e não num `.helper()`, porque
  // embrulha o `app.route.user` anterior (o do core ou de outra extensão).
  const userUrl = app.route.user;
  app.route.user = (user: User) =>
    app.forum && forumBool('canelaUserSummary', true) && app.forum.attribute('canelaUserDefaultTab') === 'summary'
      ? app.route('user.summary', { username: user.slug() })
      : userUrl(user);

  extend(UserPage.prototype, 'oninit', function () {
    const username = m.route.param('username');

    if (!username || !forumBool('canelaUserSummary', true) || app.forum.attribute('canelaUserDefaultTab') !== 'summary') return;

    // Só o endereço sem aba: as rotas `user` e `user.posts` do core dividem o
    // mesmo caminho, então o nome da rota não basta para distinguir.
    if (m.route.get().split('?')[0] === app.route('user', { username })) {
      m.route.set(app.route('user.summary', { username }), undefined, { replace: true });
    }
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || !items.has('posts')) return;

    (items.get('posts') as any).attrs.href = app.route('user.activity', { username: this.user.slug() });
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    // O atributo do fórum é lido aqui, e não no install: no initializer o
    // `app.forum` ainda não existe.
    if (!this.user || !forumBool('canelaUserSummary', true)) return;

    items.add(
      'summary',
      <LinkButton href={app.route('user.summary', { username: this.user.slug() })} icon="far fa-user">
        {t('user.summary.nav')}
      </LinkButton>,
      110
    );
  });
}
