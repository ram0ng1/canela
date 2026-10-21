import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import CommunityPage from './CommunityPage';
import DirectoryState from './DirectoryState';
import DirectoryTable from './DirectoryTable';
import DirectoryControls from './DirectoryControls';
import GroupFlair from './GroupFlair';
import { fetchGroupActivity } from './api';
import { findGroup, groupSlug, groupsEnabled, memberCount } from './groups';
import { forumBool, t } from '../../utils/settings';
import { fullDate, shortAge } from '../../utils/dates';

type Tab = 'members' | 'activity';

const EXCERPT_LENGTH = 300;

/**
 * A página de um grupo (/g/:nome): o cabeçalho com o símbolo e o
 * nome, e as abas Membros e Atividade.
 *
 * A aba vai na própria URL (?tab=activity) pelo mesmo motivo do diretório:
 * trocar de aba não deve recriar a página e perder a lista carregada.
 */
export default class GroupPage extends CommunityPage {
  group: Group | null = null;
  tab: Tab = 'members';
  members: DirectoryState | null = null;

  posts: Post[] = [];
  postsLoading = false;
  postsLoaded = false;
  postsPage = 0;
  postsHasMore = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    // O grupo antes do `super`: o título da aba sai do nome dele.
    this.group = findGroup(m.route.param('name'));
    this.tab = m.route.param('tab') === 'activity' && this.activityEnabled() ? 'activity' : 'members';

    super.oninit(vnode);

    if (!this.enabled() || !this.group) return;

    if (this.canViewMembers()) {
      this.members = new DirectoryState({ group: this.group.id(), order: 'username', dir: 'asc' });
      this.members.refresh();
    }

    if (this.tab === 'activity') this.loadActivity();
  }

  title(): string {
    return this.group ? this.group.namePlural() : t('community.groups.title');
  }

  className(): string {
    return 'CanelaGroupPage';
  }

  enabled(): boolean {
    return groupsEnabled();
  }

  activityEnabled(): boolean {
    return forumBool('canelaGroupsActivity', true);
  }

  canViewMembers(): boolean {
    return forumBool('canelaCanViewDirectory', false);
  }

  content(): Mithril.Children {
    if (!this.group) {
      return (
        <div className="CanelaGroup">
          <p className="CanelaCommunity-empty">{t('community.groups.not_found')}</p>
          <LinkButton className="Button" href={app.route('canela.groups')} icon="fas fa-arrow-left">
            {t('community.groups.back')}
          </LinkButton>
        </div>
      );
    }

    return (
      <div className="CanelaGroup">
        {this.header(this.group)}
        {this.tabs()}
        <div className="CanelaGroup-body">{this.tab === 'activity' ? this.activity() : this.membersView()}</div>
      </div>
    );
  }

  /** O `group-details-container`: o flair de 50px, o nome grande e o @endereço. */
  header(group: Group): Mithril.Children {
    return (
      <header className="CanelaGroup-header" style={group.color() ? { '--group-color': group.color() } : undefined}>
        <div className="CanelaGroup-info">
          {group.icon() && <GroupFlair group={group} size="large" />}
          <div className="CanelaGroup-headerInfo">
            <h1 className="CanelaGroup-name">{group.namePlural()}</h1>
            <div className="CanelaGroup-mention">@{groupSlug(group)}</div>
          </div>
        </div>
      </header>
    );
  }

  tabs(): Mithril.Children {
    const items = new ItemList<Mithril.Children>();
    const count = this.group ? memberCount(this.group) : null;

    items.add('members', this.tabButton('members', 'fas fa-users', t('community.groups.tab_members'), count), 100);

    if (this.activityEnabled()) {
      items.add('activity', this.tabButton('activity', 'fas fa-bars', t('community.groups.tab_activity')), 90);
    }

    return (
      <nav className="CanelaGroup-tabs" aria-label={t('community.groups.tabs_label')}>
        <ul>{items.toArray()}</ul>
      </nav>
    );
  }

  tabButton(tab: Tab, icon: string, label: string, count: number | null = null): Mithril.Children {
    const active = this.tab === tab;

    return (
      <li className={classList({ active })}>
        <Button
          className={classList('Button CanelaGroup-tab', { active })}
          icon={icon}
          aria-current={active ? 'page' : undefined}
          onclick={() => this.setTab(tab)}
        >
          {label}
          {count !== null && <span className="CanelaGroup-tabCount">({count})</span>}
        </Button>
      </li>
    );
  }

  setTab(tab: Tab): void {
    this.tab = tab;

    if (tab === 'activity' && !this.postsLoaded && !this.postsLoading) this.loadActivity();

    const url = app.route('canela.group', { name: m.route.param('name') }) + (tab === 'activity' ? '?tab=activity' : '');
    window.history.replaceState(window.history.state, '', url);
  }

  membersView(): Mithril.Children {
    if (!this.members) {
      return (
        <p className="CanelaCommunity-empty">{app.session.user ? t('community.groups.members_forbidden') : t('community.groups.members_login')}</p>
      );
    }

    return [<DirectoryControls state={this.members} />, <DirectoryTable state={this.members} emptyText={t('community.groups.no_members')} />];
  }

  loadActivity(): void {
    if (!this.group) return;

    this.postsLoading = true;
    const page = this.postsPage + 1;

    fetchGroupActivity(this.group.id()!, page)
      .then((response) => {
        this.postsHasMore = response.meta.hasMore;
        this.postsPage = page;

        if (!response.data.length) return [] as Post[];

        // Os ids já vêm filtrados pela visibilidade; o /api/posts serializa
        // cada postagem com o que as extensões acrescentam.
        return app.store.find<Post[]>('posts', {
          filter: { id: response.data.join(',') },
          include: 'user,discussion',
          page: { limit: response.data.length },
        } as any);
      })
      .then((posts) => {
        const sorted = [...posts].sort((a, b) => (b.createdAt()?.getTime() || 0) - (a.createdAt()?.getTime() || 0));
        this.posts = [...this.posts, ...sorted];
      })
      .catch(() => {})
      .finally(() => {
        this.postsLoading = false;
        this.postsLoaded = true;
        m.redraw();
      });
  }

  activity(): Mithril.Children {
    if (!this.postsLoaded && this.postsLoading) return <LoadingIndicator display="block" />;

    if (!this.posts.length) return <p className="CanelaCommunity-empty">{t('community.groups.no_activity')}</p>;

    return (
      <div className="CanelaGroup-activity">
        <ul className="CanelaStream">{this.posts.map((post) => this.streamItem(post))}</ul>
        {this.postsLoading && <LoadingIndicator display="block" />}
        {!this.postsLoading && this.postsHasMore && (
          <div className="CanelaCommunity-more">
            <Button className="Button" onclick={() => this.loadActivity()}>
              {t('community.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  /** Um item do "stream" de atividade: avatar, tópico, quando e o começo do texto. */
  streamItem(post: Post): Mithril.Children {
    const user = post.user();
    const discussion = post.discussion();
    const createdAt = post.createdAt();

    return (
      <li key={post.id()} className="CanelaStream-item">
        <div className="CanelaStream-header">
          {user ? (
            <Link href={app.route.user(user)} className="CanelaStream-avatar">
              <Avatar user={user} />
            </Link>
          ) : (
            <span className="CanelaStream-avatar">
              <Avatar user={null} />
            </span>
          )}
          <div className="CanelaStream-titles">
            {discussion && (
              <Link href={app.route.post(post)} className="CanelaStream-topic">
                {discussion.title()}
              </Link>
            )}
            <span className="CanelaStream-meta">
              {user && <Link href={app.route.user(user)}>{user.displayName()}</Link>}
              {createdAt && (
                <time datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
                  {shortAge(createdAt)}
                </time>
              )}
            </span>
          </div>
        </div>
        <p className="CanelaStream-excerpt">{truncate(post.contentPlain() || '', EXCERPT_LENGTH)}</p>
      </li>
    );
  }
}
