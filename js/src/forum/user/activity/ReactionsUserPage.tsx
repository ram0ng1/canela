/*
 * A aba "Reações" do perfil: curtidas e
 * reações que a pessoa deu, numa lista só, da mais nova para a mais antiga.
 * No Canela a curtida é a reação "coração", então ela aparece como ❤️.
 * Cada item é o `user-stream-item` das outras abas (avatar do autor, título,
 * categoria, data e trecho) com a linha da reação: o emoji e o avatar de
 * quem reagiu.
 *
 * A ordem e a visibilidade vêm de `/api/users/{id}/canela-reactions`
 * (extend/activity.php); os posts, de `/api/posts?filter[id]=…`.
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import streamItem from '../streamItem';
import { leaveIfHidden } from './install';
import { extModule } from '../../thirdparty/settings';
import { isTagsEnabled } from '../../utils/tags';
import { t } from '../../utils/settings';

const PAGE_SIZE = 20;

/** Uma linha da API: `reactionId` nulo é uma curtida. */
interface Row {
  postId: number;
  reactionId: number | null;
}

interface ReactionGroup {
  post: Post;
  /** Chaves únicas: `like` ou o id da reação. */
  keys: string[];
}

export default class ReactionsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  private rows: Row[] = [];
  private loading = true;
  private hasMore = false;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    if (leaveIfHidden('reactions', user)) return;

    super.show(user);

    this.rows = [];
    this.load();
  }

  content() {
    const groups = this.groups();

    if (!groups.length) return this.loading ? <LoadingIndicator /> : <Placeholder text={t('user.nav.reactions_empty')} />;

    return (
      <div className="PostsUserPage CanelaReactionsUserPage">
        <ul className="PostList-discussions CanelaReactionsList">
          {groups.map((group) => (
            <li key={group.post.id()} data-id={group.post.id()}>
              {streamItem(group.post, { className: 'CanelaStreamItem--reaction', extra: this.reactionRow(group) })}
            </li>
          ))}
        </ul>
        {(this.loading || this.hasMore) && (
          <div className="PostList-loadMore">
            {this.loading ? (
              <LoadingIndicator />
            ) : (
              <Button className="Button" onclick={() => this.load()}>
                {app.translator.trans('core.forum.post_list.load_more_button')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  private reactionRow(group: ReactionGroup): Mithril.Children {
    return (
      <div className="CanelaStreamItem-reaction">
        {group.keys.map((key) => (
          <span className="CanelaStreamItem-reactionEmoji">{this.emoji(key)}</span>
        ))}
        <Avatar user={this.user} className="CanelaStreamItem-reactionAvatar" />
      </div>
    );
  }

  /** O emoji do fof (a mesma imagem dos posts); a curtida é a reação "heart", ou o coração. */
  private emoji(key: string): Mithril.Children {
    const ReactionComponent = extModule<any>('fof-reactions', 'common/components/ReactionComponent');
    const reaction =
      key === 'like' ? app.store.all('reactions').find((item: any) => item.identifier?.() === 'heart') : app.store.getById('reactions', key);

    if (ReactionComponent && reaction) return m(ReactionComponent, { reaction });

    return key === 'like' ? <Icon name="fas fa-heart" className="CanelaStreamItem-likeIcon" /> : null;
  }

  /** Um item por post; curtida e coração do fof no mesmo post contam uma vez. */
  private groups(): ReactionGroup[] {
    const groups: ReactionGroup[] = [];
    const byPost = new Map<string, ReactionGroup>();
    const heart = app.store.all('reactions').find((item: any) => item.identifier?.() === 'heart');
    const heartId = heart ? String(heart.id()) : null;

    this.rows.forEach((row) => {
      const post = app.store.getById<Post>('posts', String(row.postId));

      if (!post || !post.discussion()) return;

      const key = row.reactionId === null || String(row.reactionId) === heartId ? 'like' : String(row.reactionId);
      let group = byPost.get(post.id()!);

      if (!group) {
        group = { post, keys: [] };
        byPost.set(post.id()!, group);
        groups.push(group);
      }

      if (!group.keys.includes(key)) group.keys.push(key);
    });

    return groups;
  }

  private async load(): Promise<void> {
    if (!this.user) return;

    this.loading = true;

    try {
      const page = await app.request<{ data: Row[]; hasMore: boolean }>({
        method: 'GET',
        url: `${app.forum.attribute('apiUrl')}/users/${this.user.id()}/canela-reactions`,
        params: { page: { offset: this.rows.length, limit: PAGE_SIZE } },
      });

      const ids = [...new Set(page.data.map((row) => String(row.postId)))].filter((id) => !app.store.getById('posts', id));

      if (ids.length) {
        const include = ['discussion', 'user'];
        if (isTagsEnabled()) include.push('discussion.tags');

        await app.store.find<Post[]>('posts', { filter: { id: ids.join(',') }, include: include.join(','), page: { limit: ids.length } } as any);
      }

      this.rows = [...this.rows, ...page.data];
      this.hasMore = page.hasMore;
    } catch {
      this.hasMore = false;
    } finally {
      this.loading = false;
      m.redraw();
    }
  }
}
