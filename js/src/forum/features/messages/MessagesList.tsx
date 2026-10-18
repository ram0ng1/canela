/*
 * A lista de mensagens do perfil no formato da lista de tópicos do Discourse
 * (`topic-list` com `showPosters` e `hideCategory`, como em
 * `build-private-messages-route.js`): Tópico | participantes | Respostas |
 * Atividade. Mensagem não tem visualizações nem categoria.
 *
 * A marcação repete a da lista de tópicos do tema (`.CanelaList`,
 * `.DiscussionListItem`, `.CanelaTopic-*`, `.CanelaCell--*`) para herdar as
 * mesmas medidas — a lista de mensagens do Discourse é a mesma tabela.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Tooltip from 'flarum/common/components/Tooltip';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import type BoxListState from './BoxListState';
import { fullDate, shortAge } from '../../utils/dates';
import { repliesHeat, viewsHeat } from '../../list/metrics';
import { forumBool, t } from '../../utils/settings';
import { dialogHref, dialogTitle, dialogViews, groupLabel, messageCount, participants, staffGroups, type Dialog } from './util';

export interface MessagesListAttrs extends ComponentAttrs {
  state: BoxListState;
  /** O estado vazio da caixa (título e texto do Discourse). */
  empty: () => Mithril.Children;
}

/** O calor das contagens, como na lista de tópicos (`.heatmap-*`). */
function heatClass(heat: string | null): string | undefined {
  return heat && forumBool('canelaListHeat', true) ? `CanelaCell--heat-${heat}` : undefined;
}

export default class MessagesList extends Component<MessagesListAttrs> {
  view(): Mithril.Children {
    const state = this.attrs.state;

    if (state.isInitialLoading()) return <LoadingIndicator display="block" />;

    const dialogs = state.dialogs();

    if (!dialogs.length) return this.attrs.empty();

    // A coluna de visualizações só existe com a contagem no banco (migration).
    const showViews = dialogs.some((dialog) => dialogViews(dialog) !== null);

    return (
      <div className={classList('DiscussionList CanelaList CanelaList--posters CanelaMessagesList', { 'CanelaList--views': showViews })}>
        <div className="CanelaListHeader" role="presentation">
          <span className="CanelaListHeader-cell CanelaListHeader-cell--topic">{t('list.topic')}</span>
          <span className="CanelaListHeader-cell CanelaCell--posters" />
          <span className="CanelaListHeader-cell CanelaCell--replies">{t('list.replies')}</span>
          {showViews ? <span className="CanelaListHeader-cell CanelaCell--views">{t('list.views')}</span> : null}
          <span className="CanelaListHeader-cell CanelaCell--activity">{t('list.activity')}</span>
        </div>
        <ul className="DiscussionList-discussions">
          {dialogs.map((dialog) => (
            <li key={dialog.id()} data-id={dialog.id()}>
              {this.row(dialog, showViews)}
            </li>
          ))}
        </ul>
        {state.hasNext() ? (
          <div className="DiscussionList-loadMore">
            <Button className="Button" loading={state.isLoadingNext()} onclick={() => state.loadNext()}>
              {app.translator.trans('core.forum.discussion_list.load_more_button')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  row(dialog: Dialog, showViews: boolean): Mithril.Children {
    const unread = dialog.unreadCount() || 0;
    const neverRead = unread > 0 && !dialog.lastReadMessageId();
    const href = dialogHref(dialog);
    const last = dialog.lastMessageAt() || dialog.createdAt();
    const lastUser = dialog.lastMessage() ? (dialog.lastMessage() as any).user?.() : null;
    const replies = Math.max(0, messageCount(dialog) - 1);
    const views = dialogViews(dialog);
    const groups = staffGroups(dialog);

    return (
      <div className={classList('DiscussionListItem CanelaMessagesItem', unread ? 'unread' : 'read')}>
        <div className="DiscussionListItem-content">
          <div className="CanelaListItem-avatar">{this.avatar(lastUser || dialog.recipient() || null)}</div>
          <div className="DiscussionListItem-main CanelaTopic">
            <h2 className="DiscussionListItem-title CanelaTopic-titleLine">
              <Link href={href} className="CanelaTopic-title">
                {dialogTitle(dialog)}
              </Link>
              {unread ? this.unreadBadge(dialog, unread, neverRead) : null}
            </h2>
            {groups.length ? (
              <div className="CanelaTopic-meta CanelaMessagesItem-groups">
                {groups.map((group) => (
                  <span className="CanelaParticipantGroup" title={group.namePlural()}>
                    <Icon name="fas fa-user-group" />
                    <span>{groupLabel(group)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="CanelaCell CanelaCell--posters CanelaPosters">{this.posters(dialog, lastUser)}</div>
          <div className={classList('CanelaCell CanelaCell--replies', heatClass(repliesHeat(replies)))}>
            <span aria-hidden="true">{abbreviateNumber(replies)}</span>
            <span className="visually-hidden">{t('list.replies_a11y', { count: replies })}</span>
          </div>
          {showViews ? (
            <div className={classList('CanelaCell CanelaCell--views', views !== null && heatClass(viewsHeat(views)))}>
              {views === null
                ? null
                : [
                    <span aria-hidden="true">{abbreviateNumber(views)}</span>,
                    <span className="visually-hidden">{t('list.views_a11y', { count: views })}</span>,
                  ]}
            </div>
          ) : null}
          <div className="CanelaCell CanelaCell--activity" title={last ? fullDate(last) : undefined}>
            <Link href={dialogHref(dialog, messageCount(dialog) || undefined)} className="CanelaActivity">
              {last ? shortAge(last) : ''}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /** A bolinha de "nova" ou a pílula com as não lidas, como na lista de tópicos. */
  unreadBadge(dialog: Dialog, unread: number, neverRead: boolean): Mithril.Children {
    const label = neverRead ? t('messages.list.new_message') : t('messages.list.unread_count', { count: unread });

    return (
      <Link
        href={dialogHref(dialog, (dialog.lastReadMessageId() || 0) + 1)}
        className={classList('CanelaUnread', neverRead ? 'CanelaUnread--new' : 'CanelaUnread--count')}
        title={label}
        aria-label={label}
      >
        {neverRead ? null : abbreviateNumber(unread)}
      </Link>
    );
  }

  /**
   * Os participantes (`topic.posters` de uma mensagem): todos, até 5 — o
   * flarum/messages manda no máximo 5 —, e quem escreveu por último com o
   * brilho do Discourse.
   */
  posters(dialog: Dialog, lastUser: User | null): Mithril.Children {
    const users = participants(dialog).slice(0, 5);

    return users.map((user, index) => {
      const latest = !!lastUser && user === lastUser;
      const label = user.displayName();

      return (
        <Tooltip text={label}>
          <Link
            href={app.route.user(user)}
            className={classList('CanelaPosters-avatar', {
              'CanelaPosters-avatar--latest': latest,
              'CanelaPosters-avatar--glow': latest && index === 0 && users.length > 1,
            })}
            aria-label={label}
          >
            <Avatar user={user} title="" />
          </Link>
        </Tooltip>
      );
    });
  }

  avatar(user: User | null): Mithril.Children {
    if (!user) return <Avatar user={null} title="" />;

    return (
      <Link href={app.route.user(user)} aria-label={user.displayName()}>
        <Avatar user={user} title="" />
      </Link>
    );
  }
}
