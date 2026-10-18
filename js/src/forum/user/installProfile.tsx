/*
 * O perfil do Discourse sobre o UserPage do core.
 *
 * O core desenha o perfil como um hero colorido de largura total e uma coluna
 * de navegação à esquerda. O Discourse põe tudo dentro do cartão: capa no
 * topo, avatar grande, nomes, uma linha de estatísticas e as abas embaixo.
 * O agente da casca já move o hero para dentro do cartão (PageStructure);
 * aqui o UserCard ganha as peças que faltam e a navegação vira abas.
 *
 * Como no Discourse, o cabeçalho completo (capa, bio, estatísticas) só
 * aparece no Resumo; nas outras abas ele encolhe para avatar pequeno e nomes
 * (`.collapsed-info`), e a lista ocupa a tela.
 *
 * Tudo só vale para o cartão do perfil (`.UserHero`): o mesmo UserCard
 * aparece como popover nos posts, e lá fica como está.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import UserCard from 'flarum/forum/components/UserCard';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import LinkButton from 'flarum/common/components/LinkButton';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import PostListItem from 'flarum/forum/components/PostListItem';
import type Discussion from 'flarum/common/models/Discussion';

import UserStats from './UserStats';
import streamItem from './streamItem';
import ScrollNav from './activity/ScrollNav';
import { ACTIVITY_ORDER } from './activity/install';
import { forumBool, t } from '../utils/settings';
import { thirdParty } from '../thirdparty/settings';
import { currentTab, tabUrl, TAB_ICONS, visibleTabs } from './preferences/tabs';
import { isTagsEnabled } from '../utils/tags';
import PostListState from 'flarum/forum/states/PostListState';
import { userIcons } from '../utils/userIcons';
import { userCoverUrl } from '../features/profile';

/** Itens do UserCard que a linha de estatísticas passa a mostrar. */
const INFO_MOVED_TO_STATS = ['lastSeen', 'joined'];

/**
 * As abas de primeiro nível do Discourse (Resumo, Atividade, Notificações,
 * Mensagens, Convites, Emblemas, Preferências). Todo o resto — postagens,
 * tópicos, curtidas, menções e o que as extensões acrescentarem — vai para
 * a segunda linha, dentro de "Atividade".
 */
const PRIMARY_NAV_KEYS = ['summary', 'badges', 'settings', 'security', 'notifications', 'messages', 'invites'];

/** Páginas do perfil que, para o próprio usuário, são abas das preferências. */
const PREFERENCE_PAGES = ['security', 'ignored-users'];

/** As abas de "Atividade" com o nome e o ícone do Discourse. */
const ACTIVITY_LABELS: Record<string, { icon: string; label?: string }> = {
  posts: { icon: 'fas fa-bars', label: 'user.nav.posts' },
  discussions: { icon: 'fas fa-list-ul', label: 'user.nav.discussions' },
  likes: { icon: 'far fa-heart' },
  mentions: { icon: 'fas fa-at' },
};

function isProfileHero(card: any): boolean {
  return /\bUserHero\b/.test(card.attrs?.className || '');
}

function statsEnabled(): boolean {
  return forumBool('canelaUserStats', true);
}

function summaryEnabled(): boolean {
  return forumBool('canelaUserSummary', true);
}

/** Fora do Resumo o cabeçalho encolhe, como o `.collapsed-info` do Discourse. */
export function profileCollapsed(): boolean {
  return summaryEnabled() && app.current.get('routeName') !== 'user.summary';
}

/** O grupo cujo ícone vira o "flair" do avatar: o primeiro com ícone. */
function flairGroup(user: User): Group | null {
  const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

  return groups.find((group) => !!group.icon()) || null;
}

export default function installProfile() {
  extendUserPage();
  extendProfileHero();
  extendUserStream();
}

/**
 * As abas de postagens do perfil (Postagens, Curtidas, Menções) como o
 * `user-stream-item` do Discourse: avatar de 48px, o título do tópico como
 * link, categoria e data embaixo e o começo do texto — sem o post inteiro com
 * seus botões, que é o que o PostListItem do core desenha.
 */
function extendUserStream() {
  // A categoria do item ("Bug • 5 dias atrás") vem das etiquetas do tópico,
  // que a lista de postagens do core não inclui.
  extend(PostListState.prototype, 'requestParams' as any, function (this: PostListState, params: any) {
    if (!isTagsEnabled() || !params) return;

    const include = typeof params.include === 'string' ? params.include.split(',') : Array.isArray(params.include) ? params.include : [];

    if (!include.includes('discussion.tags')) params.include = [...include, 'discussion.tags'];
  });

  override(PostListItem.prototype, 'view', function (this: PostListItem, original: () => Mithril.Children) {
    const post = this.attrs.post;
    const discussion = post.discussion() as Discussion | false;

    if (!/^user(\.|$)/.test(app.current.get('routeName') || '') || !discussion) return original();

    return streamItem(post);
  });
}

function extendUserPage() {
  // A classe própria liga o layout em coluna (cartão, abas, conteúdo) sem
  // depender do `Page--vertical` do core, que foi pensado para o IndexPage.
  extend(UserPage.prototype, 'view', function (this: UserPage, vnode: Mithril.Vnode<any, any>) {
    if (!vnode || !vnode.attrs) return;

    vnode.attrs.className = classList(vnode.attrs.className, 'CanelaUserPage', {
      'CanelaUserPage--cover': forumBool('canelaUserCover', true),
      'CanelaUserPage--collapsed': profileCollapsed(),
    });
  });

  // Sem o AffixedSidebar nem o SelectDropdown: duas linhas de abas no fluxo,
  // abaixo do cartão, como a `user-navigation` do Discourse.
  override(UserPage.prototype, 'sidebar', function (this: UserPage) {
    const nav = this.navItems();
    const primary = new ItemList<Mithril.Children>();
    const activity = new ItemList<Mithril.Children>();

    const self = !!this.user && this.user === app.session.user;
    const prefTab = self ? currentTab() : null;

    Object.entries(nav.toObject()).forEach(([key, item]) => {
      if (/separator/i.test(key)) return;
      // Segurança e Ignorados viram abas das preferências, como no Discourse.
      if (self && PREFERENCE_PAGES.includes(key)) return;

      const content = item.content as any;

      // "Configurações" é a entrada das preferências: abre na aba Conta e
      // fica ativa em todas as abas.
      if (key === 'settings' && self && content?.attrs) {
        content.attrs.href = tabUrl(this.user!, 'account');
        content.attrs.active = !!prefTab;
        content.children = [t('user.preferences.nav')];
      }
      const relabel = ACTIVITY_LABELS[key];

      // Os nomes e ícones do `user-navigation-secondary` do Discourse
      // ("Postagens", "Tópicos", o coração das curtidas) no lugar dos do core.
      if (relabel && content?.attrs) {
        content.attrs.icon = relabel.icon;
        if (relabel.label) content.children = [t(relabel.label)];
      }

      if (PRIMARY_NAV_KEYS.includes(key)) {
        primary.add(key, content as Mithril.Children, item.priority);
        return;
      }

      // A ordem do Discourse (Tópicos, Respostas, Lidos, Rascunhos, Curtidas,
      // Favoritos, Reações, Votos, Resolvido…); as abas de outras extensões
      // vêm depois, na ordem delas.
      const order = ACTIVITY_ORDER.indexOf(key);
      activity.add(key, content as Mithril.Children, order === -1 ? item.priority : 1000 - order);
    });

    const isActive = (content: any) => !!content?.attrs?.href && LinkButton.isActive(content.attrs);
    const activityActive = activity.toArray().some(isActive);

    if (!activity.isEmpty() && this.user) {
      primary.add(
        'activity',
        <LinkButton href={app.route('user.activity', { username: this.user.slug() })} icon="fas fa-bars" active={activityActive}>
          {t('user.nav.activity')}
        </LinkButton>,
        105
      );
    }

    return (
      <nav className="UserPage-nav CanelaUserNav">
        <ul className="CanelaUserNav-primary">{listItems(primary.toArray())}</ul>
        {activityActive && <ScrollNav className="CanelaUserNav-secondary">{listItems(activity.toArray())}</ScrollNav>}
        {prefTab && (
          <ul className="CanelaUserNav-secondary CanelaUserNav-prefs">
            {visibleTabs(this.user!).map((tab) => (
              <li className={`item-${tab}`}>
                <LinkButton href={tabUrl(this.user!, tab)} icon={TAB_ICONS[tab]} active={tab === prefTab}>
                  {t(`user.preferences.tabs.${tab}`)}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </nav>
    );
  });
}

function extendProfileHero() {
  extend(UserCard.prototype, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    if (!isProfileHero(this) || !vnode?.attrs) return;

    const user: User = this.attrs.user;
    const collapsed = profileCollapsed();
    // Sem imagem de capa enviada, a faixa não aparece: o perfil fica com o
    // topo limpo, em vez de um degradê genérico (pedido do usuário).
    const cover = forumBool('canelaUserCover', true) && !collapsed && !!userCoverUrl(user);

    vnode.attrs.className = classList(vnode.attrs.className, 'CanelaUserHero', {
      'CanelaUserHero--cover': cover,
      'CanelaUserHero--collapsed': collapsed,
    });

    const children = (Array.isArray(vnode.children) ? vnode.children : [vnode.children]) as Mithril.Children[];

    if (cover) children.unshift(<div className="CanelaUserHero-cover" aria-hidden="true" />);

    if (statsEnabled() && !collapsed) children.push(<UserStats user={user} />);

    vnode.children = children as any;
  });

  // O "flair" do Discourse: o ícone do grupo num círculo na cor dele, no canto
  // do avatar.
  extend(UserCard.prototype, 'profileItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this) || !items.has('avatar')) return;

    const group = flairGroup(this.attrs.user);

    items.setContent(
      'avatar',
      <div className="CanelaUserHero-avatar">
        {items.get('avatar')}
        {group && (
          <span
            className={classList('CanelaAvatarFlair', { 'CanelaAvatarFlair--colored': !!group.color() })}
            style={group.color() ? { '--group-color': group.color() } : undefined}
            title={group.nameSingular()}
          >
            <Icon name={group.icon()!} />
          </span>
        )}
      </div>
    );
  });

  extend(UserCard.prototype, 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this) || !statsEnabled()) return;

    INFO_MOVED_TO_STATS.forEach((key) => items.has(key) && items.remove(key));
  });

  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this)) return;

    const user: User = this.attrs.user;
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

    // Os grupos vão para a linha de estatísticas ("Grupos Admin, …") e o
    // primeiro com ícone vira o flair do avatar; as insígnias redondas que
    // sobram (suspenso, por exemplo) ficam ao lado do nome, não soltas no
    // meio do perfil.
    const badges = user.badges();
    groups.forEach((group) => badges.has(`group${group.id()}`) && badges.remove(`group${group.id()}`));
    const badgeList = badges.isEmpty() ? null : <ul className="UserCard-badges badges CanelaUserHero-badges">{listItems(badges.toArray())}</ul>;

    if (items.has('identity')) {
      items.setContent('identity', identity(user, badgeList));
    }

    if (items.has('badges')) items.remove('badges');

    if (items.has('info') && this.infoItems().isEmpty()) items.remove('info');
  });

  extend(UserCard.prototype, 'controlsItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this)) return;

    const user: User = this.attrs.user;
    const controls: ItemList<Mithril.Children> = UserControls.controls(user, this);

    // "Mensagem" (flarum/messages) sai do menu e vira o botão primário à
    // direita, como no Discourse.
    if (controls.has('sendMessage')) {
      const message = controls.get('sendMessage') as any;
      controls.remove('sendMessage');

      items.add(
        'canelaMessage',
        <Button {...(message?.attrs || {})} className="Button Button--primary CanelaUserHero-message">
          {message?.children}
        </Button>,
        110
      );
    }

    // O "Chat" do ramon/chat também sai do menu: botão ao lado da "Mensagem", como no perfil do Discourse.
    if (thirdParty.ramonChatUserButton() && controls.has('chatDirect')) {
      const chat = controls.get('chatDirect') as any;
      controls.remove('chatDirect');

      items.add(
        'canelaChat',
        <Button {...(chat?.attrs || {})} className="Button CanelaUserHero-chat" icon="fas fa-comment-dots">
          {t('chat.start_conversation')}
        </Button>,
        111
      );
    }

    const remaining = controls.toArray().filter((item: any) => !/Separator$/.test(item.itemName || ''));

    if (!remaining.length) {
      items.has('controls') && items.remove('controls');
      return;
    }

    // O menu de controles vira um botão redondo de ícone (⋮).
    const dropdown = (
      <Dropdown
        className="App-primaryControl CanelaUserHero-controls"
        menuClassName="Dropdown-menu--right"
        buttonClassName="Button Button--icon"
        label={app.translator.trans('core.forum.user_controls.button')}
        accessibleToggleLabel={app.translator.trans('core.forum.user_controls.toggle_dropdown_accessible_label')}
        icon="fas fa-ellipsis-h"
      >
        {controls.toArray()}
      </Dropdown>
    );

    if (items.has('controls')) items.setContent('controls', dropdown);
    else items.add('controls', dropdown, 100);
  });
}

/**
 * Username enorme em negrito, na mesma linha os ícones (selo de verificado,
 * utils/userIcons) e as insígnias; se for diferente, o nome de exibição embaixo.
 */
function identity(user: User, badges: Mithril.Children = null): Mithril.Children {
  const username = user.username();
  const displayName = user.displayName();

  return (
    <div className="CanelaUserHero-names">
      <h1 className="UserCard-identity CanelaUserHero-username">
        <span className="username">{username}</span>
        {userIcons(user, 'profile')}
        {badges}
      </h1>
      {displayName && displayName !== username && <h2 className="CanelaUserHero-displayName">{displayName}</h2>}
    </div>
  );
}
