import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

export interface UserTileAttrs extends ComponentAttrs {
  user: User;
  /** Uma linha extra abaixo do nome (último acesso, por exemplo). */
  meta?: Mithril.Children;
  size?: 'normal' | 'small';
}

/**
 * Avatar, nome, @usuário e "título" — o bloco de usuário das listas
 * (equipe do "Sobre", diretório, membros de grupo).
 *
 * O Flarum não tem título de usuário; o lugar fica com o nome do primeiro
 * grupo, como quando o título vem de um grupo.
 */
export default class UserTile extends Component<UserTileAttrs> {
  view(): Mithril.Children {
    const { user, meta, size = 'normal' } = this.attrs;
    const displayName = user.displayName();
    const username = user.username();
    const group = ((user.groups() || []) as (Group | undefined)[]).find((g): g is Group => !!g);
    const url = app.route.user(user);

    return (
      <div className={`CanelaUserTile CanelaUserTile--${size}`}>
        <Link href={url} className="CanelaUserTile-avatar" tabindex="-1" aria-hidden="true">
          <Avatar user={user} />
        </Link>
        <div className="CanelaUserTile-info">
          {/* A linha do nome: o usuário em negrito e o nome ao lado. */}
          <Link href={url} className="CanelaUserTile-name">
            <span className="CanelaUserTile-username">{username}</span>
            {displayName !== username && <span className="CanelaUserTile-displayName">{displayName}</span>}
          </Link>
          {group && <span className="CanelaUserTile-title">{group.nameSingular()}</span>}
          {meta && <span className="CanelaUserTile-meta">{meta}</span>}
        </div>
      </div>
    );
  }
}
