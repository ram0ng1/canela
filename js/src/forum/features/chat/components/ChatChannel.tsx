/*
 * A conversa (chat-channel.gjs e chat-thread.gjs do Discourse): a faixa das
 * fixadas, a lista de mensagens que rola de baixo para cima, o "Pular para o
 * fim", o cartão de "Participar" de quem só está olhando e o composer.
 *
 * A lista usa `flex-direction: column-reverse`, como lá: o fim da conversa é o
 * ponto de repouso da rolagem, então mensagens novas aparecem sem pular a
 * tela, e as antigas entram por cima sem mexer no que se está lendo.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat, { type ChatPane } from '../ChatStore';
import ChatMessage from './ChatMessage';
import ChatComposer from './ChatComposer';
import { ChannelIcon } from './bits';
import { channelTitle, chatRequest, ct, isSelfDm, meId, otherParticipants, displayName, pushUsers, readLocal, writeLocal } from '../utils';
import type { ChatMessage as Message } from '../types';

export interface ChatChannelAttrs extends ComponentAttrs {
  pane: ChatPane;
  targetMessageId?: number | null;
  context: 'channel' | 'thread';
}

export default class ChatChannel extends Component<ChatChannelAttrs> {
  private scroller: HTMLElement | null = null;
  private unsubscribe: Array<() => void> = [];
  private frame = 0;
  private dragging = 0;
  private pins: Message[] | null = null;
  private pinIndex = 0;
  private joining = false;
  private positioned = false;

  oninit(vnode: Mithril.Vnode<ChatChannelAttrs, this>) {
    super.oninit(vnode);

    const pane = this.attrs.pane;
    const target = this.attrs.targetMessageId || null;

    if (!pane.loaded || (target && !pane.find(target))) {
      pane.load(target).then(() => this.position());
    } else if (target) {
      pane.highlightedId = target;
    }

    if (this.attrs.context === 'channel') this.loadPins();
  }

  oncreate(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>) {
    super.oncreate(vnode);

    const pane = this.attrs.pane;

    pane.mounted++;
    this.scroller = this.element.querySelector('.chat-messages-scroller');

    this.unsubscribe.push(
      chat.on('scroll-bottom', (key) => key === pane.key && this.scrollToBottom()),
      chat.on('scroll-to', (key) => {
        const [paneKey, id] = key.split(':');
        if (paneKey === pane.key) requestAnimationFrame(() => this.scrollToMessage(Number(id)));
      }),
      chat.on('messages-added', (key) => {
        if (key !== pane.key) return;

        if (pane.atBottom) requestAnimationFrame(() => this.trackRead());
        else pane.newSinceAway++;

        m.redraw();
      })
    );

    window.addEventListener('focus', this.onFocus);

    if (pane.loaded) this.position();
  }

  onupdate(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>) {
    super.onupdate(vnode);

    const target = this.attrs.targetMessageId || null;
    const pane = this.attrs.pane;

    // Um link para outra mensagem da mesma conversa (o "em resposta a", uma
    // menção nas notificações) chega com a conversa já aberta.
    if (target && pane.targetMessageId !== target && pane.loaded && !pane.loading) {
      pane.targetMessageId = target;
      pane.highlightedId = target;

      if (pane.find(target)) this.scrollToMessage(target);
      else pane.load(target).then(() => this.position());
    }
  }

  onremove(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>) {
    super.onremove(vnode);

    this.attrs.pane.mounted--;
    this.unsubscribe.forEach((off) => off());
    window.removeEventListener('focus', this.onFocus);
    cancelAnimationFrame(this.frame);
  }

  private onFocus = () => this.trackRead();

  view(): Mithril.Children {
    const pane = this.attrs.pane;
    const channel = pane.channel;

    if (!channel) return <div className="chat-channel" />;

    const messages = pane.messages;
    const isMember = !!channel.membership?.following || channel.type === 'direct';
    const showPreview = !isMember && channel.type === 'public' && this.attrs.context === 'channel';

    return (
      <div
        className={classList('chat-channel', { 'is-empty': pane.loaded && !messages.length, 'is-loading': pane.loading })}
        data-id={channel.id}
        ondragenter={(e: DragEvent) => this.drag(e, 1)}
        ondragleave={(e: DragEvent) => this.drag(e, -1)}
        ondragover={(e: DragEvent) => e.preventDefault()}
        ondrop={(e: DragEvent) => this.drop(e)}
      >
        {this.pinnedBar()}
        <div className="chat-messages-scroller" onscroll={() => this.onScroll()}>
          <div className="chat-messages-container" role="log" aria-live="polite">
            {pane.loading && !messages.length ? (
              this.skeleton()
            ) : (
              <>
                {pane.loaded && !pane.canLoadMorePast && messages.length > 0 && this.attrs.context === 'channel' && (
                  <div className="all-loaded-message">{ct('all_loaded')}</div>
                )}
                {pane.loadingPast && this.skeleton(1)}
                {pane.loaded && !messages.length && this.emptyState()}
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.stagedKey || message.id}
                    message={message}
                    previous={messages[index - 1]}
                    next={messages[index + 1]}
                    pane={pane}
                    context={this.attrs.context}
                  />
                ))}
                {pane.loadingFuture && this.skeleton(1)}
              </>
            )}
          </div>
        </div>
        <div className="chat-scroll-to-bottom">
          <button
            type="button"
            className={classList('Button chat-scroll-to-bottom__button', { visible: !pane.atBottom || pane.canLoadMoreFuture })}
            aria-label={ct('scroll_to_bottom')}
            title={ct('scroll_to_bottom')}
            onclick={() => pane.jumpToBottom()}
          >
            {pane.newSinceAway > 0 && <span className="chat-scroll-to-bottom__new-messages">{ct('scroll_to_new_messages')}</span>}
            <Icon name="fas fa-arrow-down" />
          </button>
        </div>
        {showPreview ? this.previewCard() : <ChatComposer pane={pane} />}
        {this.dragging > 0 && (
          <div className="chat-upload-drop-zone is-visible">
            <div className="chat-upload-drop-zone__text">
              <div className="chat-upload-drop-zone__text__title">
                <Icon name="fas fa-upload" /> {ct('upload_to_channel', { title: channelTitle(channel) })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Rolagem ──────────────────────────────────────────────────────────────

  /** Depois de carregar: a mensagem pedida, o "último acesso" ou o fim. */
  private position(): void {
    requestAnimationFrame(() => {
      const pane = this.attrs.pane;

      if (!this.scroller) return;

      if (pane.targetMessageId) {
        this.scrollToMessage(pane.targetMessageId);
      } else if (pane.lastReadAtOpen && this.scroller.querySelector('.with-last-visit, .chat-message-separator-new')) {
        this.scroller.querySelector('.with-last-visit, .chat-message-separator-new')!.scrollIntoView({ block: 'start' });
      } else {
        this.scroller.scrollTop = 0;
      }

      this.positioned = true;
      this.onScroll();
    });
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (!this.scroller) return;

      this.scroller.scrollTo({ top: 0, behavior: 'smooth' });
      this.attrs.pane.atBottom = true;
      this.attrs.pane.newSinceAway = 0;
    });
  }

  private scrollToMessage(id: number): void {
    const element = this.scroller?.querySelector(`.chat-message-container[data-id="${id}"]`);

    if (!element) return;

    element.scrollIntoView({ block: 'center' });

    // O destaque some sozinho, com a transição do -highlighted.
    setTimeout(() => {
      if (this.attrs.pane.highlightedId === id) {
        this.attrs.pane.highlightedId = null;
        m.redraw();
      }
    }, 2500);
  }

  private onScroll(): void {
    cancelAnimationFrame(this.frame);

    this.frame = requestAnimationFrame(() => {
      const scroller = this.scroller;
      const pane = this.attrs.pane;

      if (!scroller || !pane.loaded) return;

      // Com column-reverse, 0 é o fim e a rolagem para cima é negativa.
      const fromBottom = Math.abs(scroller.scrollTop);
      const fromTop = scroller.scrollHeight - scroller.clientHeight - fromBottom;
      const atBottom = fromBottom < 50 && !pane.canLoadMoreFuture;

      if (atBottom !== pane.atBottom) {
        pane.atBottom = atBottom;
        if (atBottom) pane.newSinceAway = 0;
        m.redraw();
      }

      if (this.positioned && fromTop < 300) pane.loadPast();
      if (this.positioned && fromBottom < 300) pane.loadFuture();

      this.trackRead();
    });
  }

  /** Marca lida a última mensagem que está inteira na tela (com a aba em foco). */
  private trackRead(): void {
    const scroller = this.scroller;
    const pane = this.attrs.pane;

    if (!scroller || document.visibilityState !== 'visible' || !document.hasFocus()) return;

    const bottom = scroller.getBoundingClientRect().bottom;
    const items = scroller.querySelectorAll<HTMLElement>('.chat-message-container.-persisted');

    for (let i = items.length - 1; i >= 0; i--) {
      const rect = items[i].getBoundingClientRect();

      if (rect.bottom <= bottom + 2) {
        const id = Number(items[i].dataset.id);

        if (id > 0) pane.markRead(id);
        break;
      }
    }
  }

  // ─── Fixadas ──────────────────────────────────────────────────────────────

  private loadPins(): void {
    if (!app.forum.attribute<any>('canelaChat')?.pins) return;

    chatRequest('GET', `/channels/${this.attrs.pane.channelId}/pins`, undefined, undefined, { errorHandler: () => {} })
      .then((result: any) => {
        pushUsers(result.users);
        this.pins = result.messages;
        m.redraw();
      })
      .catch(() => {});
  }

  /** A faixa "Fixada" do topo: uma fixada por vez, que avança a cada clique. */
  private pinnedBar(): Mithril.Children {
    const pane = this.attrs.pane;
    const pins = (this.pins || []).filter((pin) => pane.find(pin.id)?.pinned !== false);

    if (!pins.length) return null;

    const dismissedKey = `pinsDismissed.${pane.channelId}`;

    if (readLocal<number>(dismissedKey, 0) === pins[0].id) return null;

    const index = Math.min(this.pinIndex, pins.length - 1);
    const pin = pins[index];
    const unseen = pane.channel?.membership?.hasUnseenPins;

    return (
      <div className="chat-pinned-bar" style={{ '--chat-pinned-bar-active': index }}>
        <div className="chat-pinned-bar__main">
          <button
            type="button"
            className="chat-pinned-bar__jump"
            aria-label={ct('pinned_bar.title')}
            onclick={() => {
              this.pinIndex = (index + 1) % pins.length;
              this.jumpTo(pin.id);
            }}
          />
          <div className="chat-pinned-bar__indicator">
            <div className="chat-pinned-bar__indicator-track">
              {pins.slice(0, 6).map(() => (
                <div className="chat-pinned-bar__indicator-segment" />
              ))}
              <div className="chat-pinned-bar__indicator-thumb" />
            </div>
          </div>
          <div className="chat-pinned-bar__content">
            <div className="chat-pinned-bar__label">
              <Icon name="fas fa-thumbtack" />
              {ct('pinned_bar.title')}
            </div>
            <div className="chat-pinned-bar__excerpt">{pin.excerpt}</div>
          </div>
        </div>
        <Button
          className={classList('Button Button--icon Button--flat chat-pinned-bar__see-all')}
          icon="fas fa-list"
          aria-label={ct('pinned_messages.title')}
          title={ct('pinned_messages.title')}
          onclick={() =>
            chat.isFullPage()
              ? m.route.set(`${app.route('canela.chat.channel', { slug: pane.channel!.slug || '-', id: pane.channelId })}/pins`)
              : chat.navigate({ name: 'channel-pins', channelId: pane.channelId })
          }
        >
          {unseen && <span className="chat-pinned-bar__unread-indicator" />}
        </Button>
        <Button
          className="Button Button--icon Button--flat chat-pinned-bar__dismiss"
          icon="fas fa-xmark"
          aria-label={ct('close')}
          title={ct('close')}
          onclick={() => {
            writeLocal(dismissedKey, pins[0].id);
            m.redraw();
          }}
        />
      </div>
    );
  }

  private jumpTo(id: number): void {
    const pane = this.attrs.pane;

    pane.highlightedId = id;

    if (pane.find(id)) this.scrollToMessage(id);
    else pane.load(id).then(() => this.position());
  }

  // ─── Estados ──────────────────────────────────────────────────────────────

  private skeleton(count = 3): Mithril.Children {
    return (
      <div className="chat-skeleton --animation">
        {Array.from({ length: count }, (_, i) => (
          <div className="chat-skeleton__body">
            <div className="chat-skeleton__message">
              <div className="chat-skeleton__message-avatar" />
              <div className="chat-skeleton__message-poster" />
              <div className="chat-skeleton__message-content">
                <div className="chat-skeleton__message-text">
                  <div className="chat-skeleton__message-msg" style={{ width: `${[64, 42, 80][i % 3]}%` }} />
                  <div className="chat-skeleton__message-msg" style={{ width: `${[38, 70, 22][i % 3]}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /** "Este é o começo de #canal" / "Comece a conversa com Fulano". */
  private emptyState(): Mithril.Children {
    const channel = this.attrs.pane.channel!;

    if (this.attrs.context === 'thread') return null;

    const others = otherParticipants(channel).filter((id) => id !== meId());
    const title =
      channel.type === 'direct'
        ? isSelfDm(channel)
          ? ct('placeholder_self')
          : ct('channel.empty_state.direct_message_title', { name: others.map((id) => displayName(id)).join(', ') })
        : ct('channel.empty_state.title', { channelName: `#${channel.name}` });

    return (
      <div className="empty-state">
        <div className="empty-state__image">{ChannelIcon(channel)}</div>
        <h3 className="empty-state__title">{title}</h3>
        {channel.description && <p className="empty-state__body">{channel.description}</p>}
        {channel.type === 'public' && (
          <div className="empty-state__tip">
            <p className="empty-state__tip-text">{ct('channel.empty_state.joined_tip')}</p>
            <span className="empty-state__members-facepile">
              <span className="empty-state__members-count">{m.trust(ct('channel.empty_state.members_here', { count: channel.userCount }))}</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  private previewCard(): Mithril.Children {
    const channel = this.attrs.pane.channel!;
    const canJoin = channel.status !== 'archived';

    return (
      <div className={classList('chat-channel-preview-card --logged-in', { '--no-access': !canJoin })}>
        <div className="chat-channel-preview-card__icon">
          <Icon name="fas fa-lock" />
        </div>
        <div className="chat-channel-preview-card__title">
          {canJoin
            ? ct('channel.preview_card.guest_title', { channelName: `#${channel.name}` })
            : ct('channel.preview_card.no_access_title', { channelName: `#${channel.name}` })}
        </div>
        <div className="chat-channel-preview-card__body">
          {canJoin ? ct('channel.preview_card.join_body') : ct('channel.preview_card.no_access_body')}
        </div>
        {canJoin && (
          <div className="chat-channel-preview-card__actions">
            <Button className="Button Button--primary toggle-channel-membership-button -join" loading={this.joining} onclick={() => this.join()}>
              {ct('join')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  private async join(): Promise<void> {
    const channel = this.attrs.pane.channel!;

    this.joining = true;

    try {
      const result = await chatRequest('POST', `/channels/${channel.id}/membership`);
      pushUsers(result.users);
      chat.putChannel(result.channel);
    } finally {
      this.joining = false;
      m.redraw();
    }
  }

  // ─── Arrastar e soltar ────────────────────────────────────────────────────

  private drag(e: DragEvent, delta: number): void {
    if (!e.dataTransfer?.types.includes('Files') || !app.forum.attribute<any>('canelaChat')?.uploads || !this.attrs.pane.channel?.canPost) return;

    e.preventDefault();
    this.dragging = Math.max(0, this.dragging + delta);
  }

  private drop(e: DragEvent): void {
    if (!this.dragging) return;

    e.preventDefault();
    this.dragging = 0;

    if (e.dataTransfer?.files.length) this.attrs.pane.addFiles(e.dataTransfer.files);
  }
}
