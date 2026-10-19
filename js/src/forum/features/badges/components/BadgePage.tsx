import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import BadgesBasePage from './BadgesBasePage';
import type Badge from '../models/Badge';
import type UserBadge from '../models/UserBadge';
import { badgesEnabled } from '../utils';
import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';

const PAGE_SIZE = 30;

/**
 * A página de um emblema (/badges/:id/:slug): a medalha grande, o texto longo
 * e quem ganhou, dos mais recentes aos mais antigos. Com `?username=`, vinda
 * do perfil ou de uma notificação, a pessoa aparece em destaque na lista.
 */
export default class BadgePage extends BadgesBasePage {
  badge: Badge | null = null;
  grants: UserBadge[] = [];
  loading = true;
  hasMore = false;
  failed = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (!badgesEnabled()) return;

    const id = m.route.param('id');

    // O Show traz a descrição longa, que a listagem da página /badges não traz.
    app.store
      .find<Badge>('canela-badges', id)
      .then((badge) => {
        this.badge = badge;
        this.updateTitle();
        app.history.push(this.attrs.routeName, this.title());
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());

    this.loadGrants(id, 0);
  }

  loadGrants(badgeId: string, offset: number): void {
    this.loading = true;

    app.store
      .find<UserBadge[]>('canela-user-badges', {
        filter: { badge: badgeId },
        include: 'badge,user,post,post.discussion',
        page: { offset, limit: PAGE_SIZE },
      } as any)
      .then((result: any) => {
        this.grants.push(...result);
        this.hasMore = !!result.payload?.links?.next;
      })
      .catch(() => (this.hasMore = false))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  title(): string {
    return this.badge?.name() || t('badges.page_title');
  }

  className(): string {
    return 'CanelaBadgeShow';
  }

  content(): Mithril.Children {
    if (this.failed) return <p className="CanelaBadges-empty">{t('badges.not_found')}</p>;

    if (!this.badge) return <LoadingIndicator display="block" />;

    const badge = this.badge;
    const count = badge.grantCount() || 0;
    const type = badge.type() || 'bronze';

    // O `show-badge` do Discourse: "Emblemas / Nome" como título, o cartão
    // grande com o texto longo e, embaixo, quem ganhou em grade.
    return (
      <div className="CanelaBadgeShow-inner">
        <h1 className="CanelaBadges-title CanelaBadgeShow-title">
          <Link href={app.route('canela.badges')}>{t('badges.page_title')}</Link> / {badge.name()}
        </h1>

        <div className="CanelaBadgeShow-details">
          <div className={classList('CanelaBadgeCard', 'CanelaBadgeCard--large', `CanelaBadgeCard--${type}`)}>
            <span className="CanelaBadgeCard-contents">
              <span className={`CanelaBadgeCard-icon CanelaBadgeCard-icon--${type}`} title={t(`badges.types.${type}`)} aria-hidden="true">
                <Icon name={badge.icon() || 'fas fa-certificate'} />
              </span>
              <span className="CanelaBadgeCard-info">
                <h3 className="CanelaBadgeCard-name">{badge.name()}</h3>
                <span className="CanelaBadgeCard-description CanelaBadgeShow-long">{badge.longDescription() || badge.description()}</span>
                <span className="CanelaBadgeCard-meta">
                  {t('badges.awarded', { count, number: formatNumber(count) })}
                  {badge.multipleGrant() && <span> · {t('badges.multiple_grant')}</span>}
                </span>
              </span>
            </span>
          </div>
        </div>

        {this.grantList()}
      </div>
    );
  }

  grantList(): Mithril.Children {
    if (!this.grants.length) {
      return this.loading ? <LoadingIndicator display="block" /> : <p className="CanelaBadges-empty">{t('badges.no_recipients')}</p>;
    }

    const highlighted = (m.route.param('username') || '').toLowerCase();

    return (
      <div className="CanelaBadgeShow-recipients">
        <ul className="CanelaBadgeRecipients">{this.grants.map((grant) => this.grantItem(grant, highlighted))}</ul>
        {this.hasMore && (
          <div className="CanelaBadgeShow-more">
            <Button className="Button" loading={this.loading} onclick={() => this.loadGrants(this.badge!.id()!, this.grants.length)}>
              {t('badges.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  /** O motivo de uma concessão manual: link (só http/https) ou texto. */
  reason(grant: UserBadge): Mithril.Children {
    const reason = grant.reason();

    if (!reason) return null;

    if (/^https?:\/\//i.test(reason)) {
      return (
        <a className="CanelaBadgeRecipient-post CanelaBadgeRecipient-reason" href={reason} rel="nofollow ugc noopener" target="_blank">
          {reason}
        </a>
      );
    }

    return <span className="CanelaBadgeRecipient-post CanelaBadgeRecipient-reason">{reason}</span>;
  }

  grantItem(grant: UserBadge, highlighted: string): Mithril.Children {
    const user = grant.user() as User | false;
    const post = grant.post() as Post | false;
    const discussion = post ? (post.discussion() as Discussion | false) : false;
    const grantedAt = grant.grantedAt();

    if (!user) return null;

    return (
      <li
        key={grant.id()}
        className={classList('CanelaBadgeRecipient', {
          'CanelaBadgeRecipient--highlight': highlighted && user.username().toLowerCase() === highlighted,
        })}
      >
        <Link className="CanelaBadgeRecipient-avatar" href={app.route.user(user)} tabindex="-1" aria-hidden="true">
          <Avatar user={user} />
        </Link>
        <div className="CanelaBadgeRecipient-detail">
          <Link className="CanelaBadgeRecipient-user" href={app.route.user(user)}>
            <span className="CanelaBadgeRecipient-username">{user.username()}</span>
            {user.displayName() !== user.username() && <span className="CanelaBadgeRecipient-name">{user.displayName()}</span>}
          </Link>
          {grantedAt && (
            <div className="CanelaBadgeRecipient-date">
              {app.translator.trans('ramon-canela.forum.badges.granted_ago', {
                ago: (
                  <time datetime={grantedAt.toISOString()} title={fullDate(grantedAt)}>
                    {shortAge(grantedAt)}
                  </time>
                ),
              })}
            </div>
          )}
          {post && discussion && (
            <Link className="CanelaBadgeRecipient-post" href={app.route.post(post)}>
              {discussion.title()}
            </Link>
          )}
          {this.reason(grant)}
        </div>
      </li>
    );
  }
}
