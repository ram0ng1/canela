/*
 * O menu da sessão do Discourse abre com quem está logado: avatar, nome e
 * @usuário, que levam ao perfil. No Flarum o menu começa direto em "Perfil";
 * aqui ele ganha esse cabeçalho, e o resto dos itens (de outras extensões
 * também) segue igual.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import Separator from 'flarum/common/components/Separator';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

export default function installSessionMenu() {
  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user) return;

    const displayName = user.displayName();
    const username = user.username();

    items.add(
      'canelaIdentity',
      <Link className="CanelaSessionIdentity" href={app.route.user(user)}>
        <Avatar user={user} className="CanelaSessionIdentity-avatar" />
        <span className="CanelaSessionIdentity-names">
          <span className="CanelaSessionIdentity-name">{displayName}</span>
          {displayName !== username && <span className="CanelaSessionIdentity-username">@{username}</span>}
        </span>
      </Link>,
      200
    );

    items.add('canelaIdentitySeparator', <Separator />, 150);
  });
}
