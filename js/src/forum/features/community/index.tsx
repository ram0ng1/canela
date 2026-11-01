/*
 * Páginas de comunidade: Sobre (/about), Usuários (/u) e Grupos
 * (/g, /g/:nome). Aqui ficam os pontos de entrada nas outras áreas: os links
 * no menu "Mais" da barra lateral e os grupos clicáveis no perfil.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard, { type IUserCardAttrs } from 'flarum/forum/components/UserCard';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import type ItemList from 'flarum/common/utils/ItemList';
import type Group from 'flarum/common/models/Group';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import { forumBool, t } from '../../utils/settings';
import { groupsEnabled, groupUrl } from './groups';
import { guidelinesEnabled } from './AboutNav';

export default function installCommunity() {
  extendSidebarMore();
  extendProfileGroups();
}

function extendSidebarMore() {
  extend(CanelaSidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    // Logo abaixo de Configurações (80) e acima dos atalhos (10), na ordem do
    // menu "Mais".
    if (forumBool('canelaAboutEnabled', true)) {
      items.add(
        'canelaAbout',
        <LinkButton href={app.route('canela.about')} icon="fas fa-circle-info">
          {t('community.about.title')}
        </LinkButton>,
        75
      );
    }

    // "Diretrizes" (o antigo "FAQ" do menu).
    if (guidelinesEnabled()) {
      items.add(
        'canelaGuidelines',
        <LinkButton href={app.route('canela.guidelines')} icon="fas fa-circle-question">
          {t('community.guidelines.title')}
        </LinkButton>,
        74.5
      );
    }

    if (groupsEnabled()) {
      items.add(
        'canelaGroups',
        <LinkButton href={app.route('canela.groups')} icon="fas fa-user-group">
          {t('community.groups.title')}
        </LinkButton>,
        74
      );
    }

    // Sem a permissão de listar usuários, o link levaria a uma página vazia.
    if (forumBool('canelaDirectoryEnabled', true) && forumBool('canelaCanViewDirectory', false)) {
      items.add(
        'canelaUsers',
        <LinkButton href={app.route('canela.users')} icon="fas fa-users">
          {t('community.users.title')}
        </LinkButton>,
        73
      );
    }
  });
}

/**
 * As pílulas de grupo do cartão do perfil (item `canelaGroups`, posto pela
 * área do perfil) viram links para /g/:nome. Só troca o item quando ele
 * existe: o desenho das pílulas é da área do perfil — aqui elas só ganham o
 * link —, e por isso esta instalação precisa vir depois da do perfil.
 */
function extendProfileGroups() {
  extend(UserCard.prototype, 'contentItems', function (this: UserCard, items: ItemList<Mithril.Children>) {
    if (!items.has('canelaGroups') || !groupsEnabled() || !forumBool('canelaGroupsProfileLinks', true)) return;

    // O core 2.x-dev tipa o attr como `userd` (erro de digitação), mas passa `user`.
    const user = (this.attrs as IUserCardAttrs & { user: User }).user;
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

    items.setContent(
      'canelaGroups',
      <ul className="CanelaUserHero-groups">
        {groups.map((group) => (
          <li className="CanelaGroupPill CanelaGroupPill--link" style={group.color() ? { '--group-color': group.color() } : undefined}>
            <Link href={groupUrl(group)} className="CanelaGroupPill-link">
              {group.icon() ? <Icon name={group.icon()!} className="CanelaGroupPill-icon" /> : <span className="CanelaGroupPill-dot" />}
              <span className="CanelaGroupPill-name">{group.nameSingular()}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  });
}
