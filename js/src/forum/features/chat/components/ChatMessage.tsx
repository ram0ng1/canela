/*
 * Uma mensagem do chat, com esta estrutura:
 *
 * - o separador de dia (e o "último acesso") antes da primeira mensagem do dia;
 * - mensagens seguidas da mesma pessoa, com menos de 5 minutos entre elas, sem
 *   avatar nem nome — só a hora, que aparece na margem ao passar o mouse;
 * - "em resposta a" acima, quando a mensagem respondida não é a anterior;
 * - o texto, os anexos, as reações e o indicador do fio;
 * - as ações ao passar o mouse (reações rápidas, reagir, responder, o menu "…").
 *
 * Apagada, ela vira a linha recolhida "Uma mensagem foi excluída. [view]",
 * que abre ao clicar — e só aparece para a moderação e para o autor.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat, { type ChatPane } from '../ChatStore';
import { cardFor, ChatUserAvatar } from './bits';
import MessageActions from './MessageActions';
import { chatUser, ct, displayName, emoji, longDate, meId, messageTime, sameDay, separatorDate, tinyTime } from '../utils';
import { openEmojiPicker } from '../../composer/emoji/pickerLazy';
import type { ChatMessage as Message } from '../types';

export interface ChatMessageAttrs extends ComponentAttrs {
  message: Message;
  previous?: Message;
  next?: Message;
  pane: ChatPane;
  context: 'channel' | 'thread' | 'pinned' | 'search';
  interactive?: boolean;
  separator?: boolean;
}

/** Mensagens seguidas do mesmo autor, até 5 minutos, ficam agrupadas. */
const GROUP_MS = 300000;

export function hideUserInfo(message: Message, previous?: Message): boolean {
  if (message.pinned || !previous || previous.deletedAt) return false;
  if (Math.abs(new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime()) > GROUP_MS) return false;
  if (!sameDay(new Date(message.createdAt), new Date(previous.createdAt))) return false;

  if (message.inReplyTo) return message.inReplyTo.id === previous.id && message.userId === previous.userId;

  return message.userId === previous.userId;
}

/** A mensagem com o mouse em cima (ou com o menu "…" aberto) mostra as ações. */
let activeId: number | null = null;
let menuOpenId: number | null = null;

export function setMenuOpen(id: number | null): void {
  menuOpenId = id;
  m.redraw();
}

export default class ChatMessage extends Component<ChatMessageAttrs> {
  view(): Mithril.Children {
    const { message, previous, next, pane, context } = this.attrs;
    const interactive = this.attrs.interactive !== false;

    // Várias apagadas em sequência viram uma linha só: "3 mensagens foram
    // excluídas", na última delas.
    if (message.deletedAt && !message.expanded && next?.deletedAt && !next.expanded && context !== 'pinned') return null;

    const hidden = context === 'channel' || context === 'thread' ? hideUserInfo(message, previous) : false;
    const channel = pane.channel;
    const threadsOn = !!channel?.threadingEnabled;
    const replyHidden = context === 'thread' || !message.inReplyTo || message.inReplyTo.id === previous?.id || threadsOn;
    const showThread = context === 'channel' && threadsOn && !!message.thread && message.thread.replyCount > 0;
    const active = interactive && (activeId === message.id || menuOpenId === message.id) && !message.staged && app.screen() !== 'phone';

    // Sem `key` aqui dentro: o separador pode faltar, e o Mithril não aceita
    // irmãos com e sem chave na mesma lista.
    return [
      this.attrs.separator !== false ? this.separator() : null,
      <div
        className={classList('chat-message-container', {
          '-highlighted': pane.highlightedId === message.id,
          'is-by-current-user': message.userId === meId(),
          '-staged': message.staged,
          '-persisted': !message.staged,
          '-active': active,
          '-deleted': !!message.deletedAt,
          '-errored': !!message.error,
          '-not-interactive': !interactive,
          'has-thread-indicator': showThread,
          '-user-info-hidden': hidden,
          'has-reply': !replyHidden,
          '-pinned': message.pinned,
        })}
        data-id={message.id}
        data-thread-id={message.threadId || undefined}
        onmouseenter={() => {
          if (!interactive) return;
          activeId = message.id;
        }}
        onmouseleave={() => {
          if (activeId === message.id) activeId = null;
        }}
        oncontextmenu={app.screen() === 'phone' && interactive ? (e: Event) => this.longPress(e) : undefined}
      >
        {message.deletedAt && !message.expanded ? (
          <div className="chat-message-text -deleted">
            <button type="button" className="Button Button--flat chat-message-expand" onclick={() => this.expand()}>
              {this.deletedLabel()}
            </button>
          </div>
        ) : (
          <div className="chat-message">
            {!replyHidden && this.inReplyTo()}
            {hidden ? this.leftGutter() : <div className="chat-message-avatar">{ChatUserAvatar(message.userId, { interactive })}</div>}
            <div className="chat-message-content">
              {hidden ? <div className="chat-message-info -author-only sr-only">{displayName(message.userId)}</div> : this.info()}
              <div className="chat-message-text">
                <div className="chat-cooked">{m.trust(message.cooked)}</div>
                {message.editedAt && !message.deletedAt && <span className="chat-message-edited">({ct('edited')})</span>}
                {message.uploads.length > 0 && this.uploads()}
              </div>
              {message.deletedAt && <div className="chat-message-deleted-by">{this.deletedBy()}</div>}
              {(message.reactions.length > 0 || false) && this.reactions(interactive)}
              {message.error && this.error()}
            </div>
            {showThread && this.threadIndicator()}
          </div>
        )}
        {active && !message.deletedAt && <MessageActions message={message} pane={pane} context={context} hidden={hidden} />}
      </div>,
    ];
  }

  oncreate(vnode: Mithril.VnodeDOM<ChatMessageAttrs, this>) {
    super.oncreate(vnode);
    this.decorate();
  }

  onupdate(vnode: Mithril.VnodeDOM<ChatMessageAttrs, this>) {
    super.onupdate(vnode);
    this.decorate();
  }

  /**
   * Decora o conteúdo da mensagem: a menção ao próprio
   * leitor fica destacada, e os links abrem fora da conversa.
   */
  private decorate(): void {
    const element = this.element as HTMLElement | undefined;
    const me = app.session.user;

    if (!element || !me) return;

    const mine = app.route('user', { username: me.slug() });

    element.querySelectorAll<HTMLAnchorElement>('.chat-cooked a.UserMention').forEach((link) => {
      link.classList.add('mention');
      link.classList.toggle('highlighted', link.getAttribute('href')?.endsWith(mine) ?? false);
    });

    element.querySelectorAll<HTMLAnchorElement>('.chat-cooked a[href]:not(.UserMention):not(.PostMention)').forEach((link) => {
      if (link.host !== window.location.host) {
        link.target = '_blank';
        link.rel = 'noopener nofollow ugc';
      }
    });
  }

  private separator(): Mithril.Children {
    const { message, previous, pane, context } = this.attrs;

    if (context !== 'channel' && context !== 'thread') return null;

    const date = new Date(message.createdAt);
    const firstOfDay = !previous || !sameDay(date, new Date(previous.createdAt));
    const lastRead = pane.lastReadAtOpen;
    const isNewest = !!lastRead && message.id > lastRead && (!previous || previous.id <= lastRead) && message.userId !== meId() && message.id > 0;

    if (firstOfDay) {
      return [
        <div className={classList('chat-message-separator chat-message-separator-date', { 'with-last-visit': isNewest })} data-id={message.id}>
          <div className="chat-message-separator__text-container">
            <span className="chat-message-separator__text">
              {separatorDate(date)}
              {isNewest && (
                <span className="chat-message-separator__last-visit">
                  <span className="chat-message-separator__last-visit-separator">-</span>
                  {ct('last_visit')}
                </span>
              )}
            </span>
          </div>
        </div>,
        <div className="chat-message-separator__line-container">
          <div className="chat-message-separator__line" />
        </div>,
      ];
    }

    if (isNewest) {
      return (
        <div className="chat-message-separator chat-message-separator-new" data-id={message.id}>
          <div className="chat-message-separator__text-container">
            <span className="chat-message-separator__text">{ct('last_visit')}</span>
          </div>
          <div className="chat-message-separator__line-container">
            <div className="chat-message-separator__line" />
          </div>
        </div>
      );
    }

    return null;
  }

  private info(): Mithril.Children {
    const { message, context } = this.attrs;
    const user = chatUser(message.userId);
    const date = new Date(message.createdAt);

    return (
      <div className="chat-message-info">
        <span className={classList('chat-message-info__username', { 'is-current-user': message.userId === meId() })}>
          <button type="button" className="chat-message-info__username__name" onclick={user ? (e: MouseEvent) => cardFor(user, e) : undefined}>
            {displayName(message.userId)}
          </button>
        </span>
        <span className="chat-message-info__date" title={longDate(date)}>
          <span className="chat-time">{message.staged ? '' : messageTime(date)}</span>
        </span>
        {message.pinned && context !== 'pinned' && (
          <span className="chat-message-info__pinned" title={ct('pinned')}>
            <Icon name="fas fa-thumbtack" />
          </span>
        )}
      </div>
    );
  }

  private leftGutter(): Mithril.Children {
    const date = new Date(this.attrs.message.createdAt);

    return (
      <div className="chat-message-left-gutter">
        <span className="chat-message-left-gutter__date" title={longDate(date)}>
          <span className="chat-time">{this.attrs.message.staged ? '' : tinyTime(date)}</span>
        </span>
      </div>
    );
  }

  private inReplyTo(): Mithril.Children {
    const reply = this.attrs.message.inReplyTo!;

    return (
      <button type="button" className="chat-reply is-direct-reply" onclick={() => this.jumpTo(reply.id)}>
        <Icon name="fas fa-share" />
        {ChatUserAvatar(reply.userId, { interactive: false })}
        <span className="chat-reply__excerpt">{reply.deleted ? <em>{ct('deleted_message')}</em> : reply.excerpt}</span>
      </button>
    );
  }

  /** Leva até a mensagem: rola se ela está carregada, senão recarrega em volta dela. */
  private jumpTo(id: number): void {
    const pane = this.attrs.pane;

    if (pane.find(id)) {
      pane.highlightedId = id;
      chat.emit('scroll-to', `${pane.key}:${id}`);
    } else {
      pane.load(id).then(() => chat.emit('scroll-to', `${pane.key}:${id}`));
    }

    m.redraw();
  }

  private uploads(): Mithril.Children {
    return (
      <div className="chat-uploads">
        {this.attrs.message.uploads.map((upload) => (
          <a key={upload.id} className="chat-img-upload" href={upload.url} target="_blank" rel="noopener">
            <img
              src={upload.url}
              alt={upload.name}
              loading="lazy"
              width={upload.width || undefined}
              height={upload.height || undefined}
              style={upload.width && upload.height ? { aspectRatio: `${upload.width} / ${upload.height}` } : undefined}
            />
          </a>
        ))}
      </div>
    );
  }

  private reactions(interactive: boolean): Mithril.Children {
    const message = this.attrs.message;
    const me = meId();
    const canReact = interactive && !!this.attrs.pane.channel?.canPost && !message.deletedAt && !message.staged;

    return (
      <div className="chat-message-reaction-list">
        {message.reactions.map((reaction) => {
          const reacted = reaction.userIds.includes(me);

          return (
            <Tooltip key={reaction.emoji} text={reactionTitle(reaction.emoji, reaction.userIds, reaction.count)}>
              <button
                type="button"
                className={classList('chat-message-reaction', { reacted, 'is-new': reaction.count === 1 })}
                aria-pressed={reacted ? 'true' : 'false'}
                aria-label={ct('reactions.counted', { emoji: reaction.emoji, count: reaction.count })}
                disabled={!canReact}
                onclick={() => chat.react(message, reaction.emoji)}
              >
                {emoji(reaction.emoji)}
                <span className="count">{reaction.count}</span>
              </button>
            </Tooltip>
          );
        })}
        {canReact && app.screen() !== 'phone' && (
          <button
            type="button"
            className="Button Button--flat chat-message-reaction chat-message-react-btn react-btn"
            aria-label={ct('react')}
            title={ct('react')}
            onclick={(e: MouseEvent) => openEmojiPicker(e.currentTarget as HTMLElement, (char) => chat.react(message, char, true))}
          >
            <Icon name="far fa-face-smile" />
          </button>
        )}
      </div>
    );
  }

  private threadIndicator(): Mithril.Children {
    const { message, pane } = this.attrs;
    const thread = message.thread!;
    const extra = thread.participantCount - thread.participantIds.length;

    return (
      <a
        className="chat-message-thread-indicator"
        href={`${app.route('canela.chat.channel', { slug: pane.channel?.slug || '-', id: pane.channelId })}/t/${thread.id}`}
        title={ct('threads.open')}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          chat.openThread(pane.channelId, thread.id);
        }}
      >
        <div className="chat-message-thread-indicator__last-reply-avatar">
          {ChatUserAvatar(thread.lastReplyUserId, { interactive: false, size: 'small' })}
        </div>
        <div className="chat-message-thread-indicator__last-reply-info">
          <span className="chat-message-thread-indicator__last-reply-username">{chatUser(thread.lastReplyUserId)?.username() ?? ''}</span>
          <span className="chat-message-thread-indicator__last-reply-timestamp">
            {thread.lastReplyCreatedAt ? relativeAgo(new Date(thread.lastReplyCreatedAt)) : ''}
          </span>
        </div>
        <div className="chat-message-thread-indicator__replies-count">{ct('thread.replies', { count: thread.replyCount })}</div>
        <div className="chat-thread-participants">
          <div className="chat-thread-participants__avatar-group">
            {thread.participantIds.map((id) => ChatUserAvatar(id, { interactive: false, size: 'tiny' }))}
          </div>
          {extra > 0 && <div className="chat-thread-participants__other-count">{ct('thread.participants_other_count', { count: extra })}</div>}
        </div>
        <div className="chat-message-thread-indicator__last-reply-excerpt">{thread.lastReplyExcerpt}</div>
      </a>
    );
  }

  private error(): Mithril.Children {
    const message = this.attrs.message;

    return (
      <div className="chat-message-error">
        {message.error === 'network' ? (
          <button type="button" className="Button Button--flat chat-message-error__retry-btn" onclick={() => this.attrs.pane.retry(message)}>
            <Icon name="fas fa-circle-exclamation" />
            <span className="chat-message-error__retry-btn-title">{ct('retry_staged_message.title')}</span>
            <span className="chat-message-error__retry-btn-action">{ct('retry_staged_message.action')}</span>
          </button>
        ) : (
          <span className="chat-message-error__text">{message.error}</span>
        )}
      </div>
    );
  }

  private deletedLabel(): string {
    let count = 1;
    let previous = this.attrs.previous;
    const messages = this.attrs.pane.messages;
    let index = messages.indexOf(this.attrs.message);

    while (previous?.deletedAt && !previous.expanded) {
      count++;
      index--;
      previous = messages[index - 1];
    }

    return ct('deleted', { count });
  }

  private deletedBy(): Mithril.Children {
    const message = this.attrs.message;

    return [
      <Icon name="far fa-trash-can" />,
      ' ',
      ct('deleted_by', { username: displayName(message.deletedById), time: messageTime(new Date(message.deletedAt!)) }),
    ];
  }

  /** Abre a linha recolhida — e as apagadas logo antes, que ela representava. */
  private expand(): void {
    const messages = this.attrs.pane.messages;
    let index = messages.indexOf(this.attrs.message);

    while (index >= 0 && messages[index]?.deletedAt) {
      messages[index].expanded = true;
      index--;
    }
  }

  private longPress(e: Event): void {
    e.preventDefault();
    (navigator as any).vibrate?.(5);
    MessageActions.openSheet(this.attrs.message, this.attrs.pane, this.attrs.context);
  }
}

export function reactionTitle(char: string, userIds: number[], count: number): string {
  const me = meId();
  const others = userIds.filter((id) => id !== me).map((id) => chatUser(id)?.username() ?? '?');
  const reacted = userIds.includes(me);
  const more = count - userIds.length;
  // Texto puro para a dica: o DOMParser lê o HTML sem executar nada e o
  // textContent fica só com o texto (um replace de tags deixaria remontar
  // `<scr<script>ipt>`).
  const strip = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent || '';

  if (reacted && !others.length) return strip(ct('reactions.only_you', { emoji: char }));
  if (reacted && others.length === 1) return strip(ct('reactions.you_and_single_user', { emoji: char, username: others[0] }));
  if (reacted && more <= 0)
    return strip(
      ct('reactions.you_and_multiple_users', {
        emoji: char,
        commaSeparatedUsernames: others.slice(0, -1).join(', '),
        username: others[others.length - 1],
      })
    );
  if (reacted) return strip(ct('reactions.you_multiple_users_and_more', { emoji: char, commaSeparatedUsernames: others.join(', '), count: more }));
  if (others.length === 1 && more <= 0) return strip(ct('reactions.single_user', { emoji: char, username: others[0] }));
  if (more <= 0)
    return strip(
      ct('reactions.multiple_users', { emoji: char, commaSeparatedUsernames: others.slice(0, -1).join(', '), username: others[others.length - 1] })
    );

  return strip(ct('reactions.multiple_users_and_more', { emoji: char, commaSeparatedUsernames: others.join(', '), count: more }));
}

/** "há 3 min", "há 2 h": o `leaveAgo` do indicador do fio. */
export function relativeAgo(date: Date): string {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return ct('ago.now');
  if (seconds < 3600) return ct('ago.minutes', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return ct('ago.hours', { count: Math.floor(seconds / 3600) });

  return ct('ago.days', { count: Math.floor(seconds / 86400) });
}
