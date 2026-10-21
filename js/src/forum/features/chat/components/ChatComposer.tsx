/*
 * O composer do chat: o campo que cresce com
 * o texto, o "+" com o anexo, o emoji, o enviar, a faixa de "respondendo a" ou
 * "editando", as miniaturas dos anexos e o "fulano está digitando…".
 *
 * Teclado, como lá: Enter envia (ou Ctrl/⌘+Enter, conforme a preferência),
 * Shift+Enter quebra a linha, Esc cancela a resposta/edição, ↑ com o campo
 * vazio edita a última mensagem própria. `@` sugere pessoas e `:` sugere emoji.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat, { type ChatPane } from '../ChatStore';
import { ChatUserAvatar } from './bits';
import { chatRequest, chatUser, composerPlaceholder, ct, displayName, emoji, meId, preference, pushUsers } from '../utils';
import { openEmojiPicker } from '../../composer/emoji/pickerLazy';
import { loadEmojiData, matches, normalize } from '../../composer/emoji/emojiUtils';
import type { EmojiRow } from '../../composer/emoji-data';

export interface ChatComposerAttrs extends ComponentAttrs {
  pane: ChatPane;
}

interface Suggestion {
  key: string;
  label: Mithril.Children;
  insert: string;
}

const MAX_HEIGHT_RATIO = 0.25;

export default class ChatComposer extends Component<ChatComposerAttrs> {
  private focused = false;
  private suggestions: Suggestion[] = [];
  private suggestionIndex = 0;
  private triggerStart = -1;
  private suggestRequest = 0;
  private unsubscribe: Array<() => void> = [];
  private fileInput: HTMLInputElement | null = null;

  oncreate(vnode: Mithril.VnodeDOM<ChatComposerAttrs, this>) {
    super.oncreate(vnode);

    this.unsubscribe.push(
      chat.on('focus-composer', (key) => {
        if (key !== this.attrs.pane.key) return;

        const area = this.textarea();

        if (area) {
          area.value = this.attrs.pane.text;
          this.autosize();
          area.focus();
          area.setSelectionRange(area.value.length, area.value.length);
        }
      })
    );

    this.autosize();

    // No computador o foco já fica no campo ao abrir a conversa, como lá.
    if (app.screen() !== 'phone' && !this.attrs.pane.channel?.cannotPostReason) this.textarea()?.focus({ preventScroll: true });
  }

  onremove(vnode: Mithril.VnodeDOM<ChatComposerAttrs, this>) {
    super.onremove(vnode);
    this.unsubscribe.forEach((off) => off());
    chat.sendTyping(this.attrs.pane, false);
  }

  view(): Mithril.Children {
    const pane = this.attrs.pane;
    const channel = pane.channel;
    const disabled = !channel || !!channel.cannotPostReason;
    const text = pane.text;
    const uploading = pane.uploads.some((u) => !u.upload && !u.error);
    const sendEnabled = !disabled && !uploading && !pane.sending && (text.trim().length > 0 || pane.uploads.some((u) => u.upload));
    const max = app.forum.attribute<any>('canelaChat')?.maxMessageLength || 6000;
    const tooLong = text.length > max;

    return (
      <div className="chat-composer__wrapper">
        {(pane.replyTo || pane.editing) && this.messageDetails()}
        <div
          className={classList('chat-composer', {
            'is-focused': this.focused,
            'is-sending': pane.sending,
            'is-send-enabled': sendEnabled && !tooLong,
            'is-send-disabled': !sendEnabled || tooLong,
            'is-disabled': disabled,
            'is-enabled': !disabled,
          })}
          role="region"
          aria-label={ct('aria_roles.composer')}
        >
          <div className="chat-composer__outer-container">
            <div className="chat-composer__inner-container">
              {this.dropdown(disabled)}
              <div className="chat-composer__input-container" onclick={() => this.textarea()?.focus()}>
                <textarea
                  className="chat-composer__input"
                  rows={1}
                  autocapitalize="sentences"
                  autocorrect="on"
                  disabled={disabled}
                  placeholder={channel ? composerPlaceholder(channel, !!pane.threadId) : ''}
                  value={text}
                  oninput={(e: InputEvent) => this.onInput(e)}
                  onkeydown={(e: KeyboardEvent) => this.onKeyDown(e)}
                  onfocus={() => (this.focused = true)}
                  onblur={() => {
                    this.focused = false;
                    setTimeout(() => this.closeSuggestions(), 150);
                  }}
                  onpaste={(e: ClipboardEvent) => this.onPaste(e)}
                />
              </div>
              <button
                type="button"
                className="Button Button--flat chat-composer-button --emoji -emoji"
                disabled={disabled}
                aria-label={ct('emoji')}
                title={ct('emoji')}
                onclick={(e: MouseEvent) => openEmojiPicker(e.currentTarget as HTMLElement, (char) => this.insert(char))}
              >
                <Icon name="far fa-face-smile" />
              </button>
              <button
                type="button"
                className="Button Button--flat chat-composer-button -send"
                disabled={disabled || !sendEnabled || tooLong}
                tabindex={sendEnabled ? 0 : -1}
                title={ct('composer.send')}
                aria-label={ct('composer.send')}
                onmousedown={(e: MouseEvent) => e.preventDefault()}
                onclick={() => this.send()}
              >
                <Icon name="fas fa-paper-plane" />
              </button>
            </div>
          </div>
          {this.suggestions.length > 0 && this.suggestionMenu()}
        </div>
        {tooLong && <div className="chat-composer__too-long">{ct('message_too_long', { count: max })}</div>}
        {pane.uploads.length > 0 && this.uploads()}
        <div className="chat-replying-indicator-container">{this.typingIndicator()}</div>
      </div>
    );
  }

  private textarea(): HTMLTextAreaElement | null {
    return (this.element as HTMLElement | undefined)?.querySelector('.chat-composer__input') ?? null;
  }

  /** O campo cresce até um quarto da tela (`max-height: 25dvh`). */
  private autosize(): void {
    const area = this.textarea();

    if (!area) return;

    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, window.innerHeight * MAX_HEIGHT_RATIO)}px`;
  }

  private dropdown(disabled: boolean): Mithril.Children {
    if (!app.forum.attribute<any>('canelaChat')?.uploads) return null;

    return (
      <Dropdown
        className="chat-composer-dropdown"
        buttonClassName="Button Button--icon Button--flat chat-composer-dropdown__trigger-btn"
        icon="fas fa-plus"
        caretIcon={null}
        disabled={disabled}
        accessibleToggleLabel={ct('composer.toggle_toolbar')}
      >
        <Button icon="fas fa-upload" className="chat-composer-dropdown__action-btn" onclick={() => this.pickFile()}>
          {ct('upload')}
        </Button>
      </Dropdown>
    );
  }

  private pickFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
      this.fileInput.multiple = true;
      this.fileInput.onchange = () => {
        if (this.fileInput?.files?.length) this.attrs.pane.addFiles(this.fileInput.files);
        this.fileInput!.value = '';
      };
    }

    this.fileInput.click();
  }

  private onPaste(e: ClipboardEvent): void {
    const files = Array.from(e.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));

    if (files.length && app.forum.attribute<any>('canelaChat')?.uploads) {
      e.preventDefault();
      this.attrs.pane.addFiles(files);
    }
  }

  private onInput(e: InputEvent): void {
    const area = e.target as HTMLTextAreaElement;
    const pane = this.attrs.pane;

    pane.saveDraft(area.value);
    this.autosize();
    this.suggest(area);

    if (area.value.trim()) chat.sendTyping(pane, true);
    else chat.sendTyping(pane, false);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const pane = this.attrs.pane;

    if (this.suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.suggestionIndex = (this.suggestionIndex + (e.key === 'ArrowDown' ? 1 : -1) + this.suggestions.length) % this.suggestions.length;
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.choose(this.suggestionIndex);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSuggestions();
        return;
      }
    }

    if (e.key === 'Escape' && (pane.replyTo || pane.editing)) {
      e.preventDefault();
      e.stopPropagation();
      this.cancelDetails();
      return;
    }

    if (e.key === 'ArrowUp' && !pane.text && !pane.editing) {
      const own = [...pane.messages].reverse().find((m) => m.userId === meId() && !m.deletedAt && !m.staged);

      if (own) {
        e.preventDefault();
        pane.startEdit(own);
      }

      return;
    }

    if (e.key !== 'Enter' || e.isComposing) return;

    const metaEnter = preference<string>('canelaChatSendShortcut', 'enter') === 'meta_enter';
    const wantsSend = metaEnter ? e.metaKey || e.ctrlKey : !e.shiftKey && !e.altKey && !(app.screen() === 'phone' && !e.metaKey && !e.ctrlKey);

    if (wantsSend) {
      e.preventDefault();
      this.send();
    }
  }

  private send(): void {
    const pane = this.attrs.pane;
    const area = this.textarea();
    const text = area?.value ?? pane.text;

    if (pane.sending || pane.uploads.some((u) => !u.upload && !u.error)) return;

    pane.send(text).catch(() => {});

    if (area) {
      area.value = '';
      this.autosize();
      area.focus();
    }

    this.closeSuggestions();
  }

  private insert(textToInsert: string): void {
    const area = this.textarea();
    const pane = this.attrs.pane;

    if (!area) return;

    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? start;
    const value = area.value.slice(0, start) + textToInsert + area.value.slice(end);

    area.value = value;
    pane.saveDraft(value);
    area.focus();
    area.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    this.autosize();
  }

  private cancelDetails(): void {
    const pane = this.attrs.pane;
    const wasEditing = !!pane.editing;

    pane.replyTo = null;
    pane.editing = null;

    if (wasEditing) {
      pane.uploads = [];
      pane.saveDraft('');
      const area = this.textarea();
      if (area) area.value = '';
      this.autosize();
    }
  }

  private messageDetails(): Mithril.Children {
    const pane = this.attrs.pane;
    const message = (pane.editing || pane.replyTo)!;

    return (
      <div className="chat-composer-message-details">
        <div className="chat-reply">
          <Icon name={pane.editing ? 'fas fa-pencil' : 'fas fa-share'} />
          {ChatUserAvatar(message.userId, { interactive: false })}
          <span className="chat-reply__username">{chatUser(message.userId)?.username() ?? displayName(message.userId)}</span>
          <span className="chat-reply__excerpt">{message.excerpt}</span>
        </div>
        <button
          type="button"
          className="Button Button--icon Button--flat cancel-message-action"
          aria-label={ct('cancel_reply')}
          title={ct('cancel_reply')}
          onclick={() => this.cancelDetails()}
        >
          <Icon name="fas fa-circle-xmark" />
        </button>
      </div>
    );
  }

  private uploads(): Mithril.Children {
    const pane = this.attrs.pane;

    return (
      <div className="chat-composer-uploads">
        <div className="chat-composer-uploads-container">
          {pane.uploads.map((item) => (
            <div
              key={item.key}
              className={classList('chat-composer-upload', {
                'chat-composer-upload--image': !!item.preview,
                'chat-composer-upload--in-progress': !item.upload && !item.error,
                'has-error': !!item.error,
              })}
            >
              <div className="preview">
                {item.preview ? <img className="preview-img" src={item.preview} alt={item.name} /> : <Icon name="far fa-file" />}
                {!item.upload && !item.error && <LoadingIndicator size="small" display="inline" />}
                {item.error && <span className="chat-composer-upload__error">{ct(`upload_errors.${item.error}`)}</span>}
              </div>
              <button
                type="button"
                className="Button Button--icon chat-composer-upload__remove-btn"
                aria-label={ct('remove_upload')}
                title={ct('remove_upload')}
                onclick={() => pane.removeUpload(item.key)}
              >
                <Icon name="fas fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /** "Ana está digitando", "Ana e Bruno estão digitando", "Ana, Bruno e mais 3…". */
  private typingIndicator(): Mithril.Children {
    const pane = this.attrs.pane;
    const now = Date.now();
    const ids = [...pane.typing.entries()].filter(([id, until]) => until > now && id !== meId()).map(([id]) => id);

    if (!ids.length) return null;

    const name = (id: number) => chatUser(id)?.username() || pane.typingNames.get(id) || '?';
    let text: string;

    if (ids.length === 1) text = ct('replying_indicator.single_user', { username: name(ids[0]) });
    else if (ids.length <= 3)
      text = ct('replying_indicator.multiple_users', {
        commaSeparatedUsernames: ids.slice(0, -1).map(name).join(', '),
        lastUsername: name(ids[ids.length - 1]),
      });
    else text = ct('replying_indicator.many_users', { commaSeparatedUsernames: ids.slice(0, 2).map(name).join(', '), count: ids.length - 2 });

    return (
      <div className="chat-replying-indicator" aria-live="polite">
        <span className="chat-replying-indicator__text">{text}</span>
        <span className="chat-replying-indicator__wave">
          <span className="chat-replying-indicator__dot">.</span>
          <span className="chat-replying-indicator__dot">.</span>
          <span className="chat-replying-indicator__dot">.</span>
        </span>
      </div>
    );
  }

  // ─── Autocompletar ────────────────────────────────────────────────────────

  private suggest(area: HTMLTextAreaElement): void {
    const caret = area.selectionStart ?? area.value.length;
    const before = area.value.slice(0, caret);
    const match = /(^|[\s(])([@:])([\p{L}\p{N}_.+-]*)$/u.exec(before);

    if (!match) return this.closeSuggestions();

    const [, , trigger, typed] = match;
    const request = ++this.suggestRequest;

    this.triggerStart = caret - typed.length - 1;

    const done = (items: Suggestion[]) => {
      if (request !== this.suggestRequest) return;

      this.suggestions = items;
      this.suggestionIndex = 0;
      m.redraw();
    };

    if (trigger === '@') {
      setTimeout(() => {
        if (request !== this.suggestRequest) return;

        chatRequest('GET', '/users', undefined, { q: typed, channel: this.attrs.pane.channelId }, { errorHandler: () => {} })
          .then((result: any) => {
            pushUsers(result.users);

            const members = new Set<number>(result.memberIds);
            const items: Suggestion[] = (result.userIds as number[])
              .filter((id) => id !== meId())
              .map((id) => {
                const user = chatUser(id);

                return {
                  key: `u${id}`,
                  insert: `@${user?.username() ?? ''}`,
                  label: [
                    ChatUserAvatar(id, { interactive: false }),
                    <span className="username">{user?.username()}</span>,
                    <span className="name">{user?.displayName()}</span>,
                    !members.has(id) && this.attrs.pane.channel?.type === 'public' ? (
                      <span className="not-member">{ct('mention_warning.not_member')}</span>
                    ) : null,
                  ],
                };
              });

            if (this.attrs.pane.channel?.allowChannelWideMentions) {
              ['here', 'all'].forEach((word) => {
                if (word.startsWith(typed.toLowerCase())) {
                  items.push({
                    key: word,
                    insert: `@${word}`,
                    label: [
                      <Icon name="fas fa-users" />,
                      <span className="username">{word}</span>,
                      <span className="name">{ct(`mention_${word}`)}</span>,
                    ],
                  });
                }
              });
            }

            done(items.slice(0, 10));
          })
          .catch(() => done([]));
      }, 150);

      return;
    }

    // Emoji só depois de duas letras: ":" de um horário (10:30) não abre nada.
    if (typed.length < 2) return this.closeSuggestions();

    loadEmojiData().then((groups) => {
      const term = normalize(typed);
      const found: EmojiRow[] = [];

      for (const pass of [(row: EmojiRow) => row[1].split(' ').some((code) => code.startsWith(term)), (row: EmojiRow) => matches(row, [term])]) {
        for (const group of groups) {
          for (const row of group.emoji) {
            if (found.length >= 8) break;
            if (!found.includes(row) && pass(row)) found.push(row);
          }
        }
      }

      done(found.map((row) => ({ key: row[0], insert: row[0], label: [emoji(row[0]), <span className="username">:{row[1].split(' ')[0]}:</span>] })));
    });
  }

  private choose(index: number): void {
    const item = this.suggestions[index];
    const area = this.textarea();

    if (!item || !area || this.triggerStart < 0) return;

    const caret = area.selectionStart ?? area.value.length;
    const value = area.value.slice(0, this.triggerStart) + item.insert + ' ' + area.value.slice(caret);
    const position = this.triggerStart + item.insert.length + 1;

    area.value = value;
    this.attrs.pane.saveDraft(value);
    area.setSelectionRange(position, position);
    area.focus();
    this.closeSuggestions();
    this.autosize();
  }

  private closeSuggestions(): void {
    this.suggestRequest++;

    if (this.suggestions.length) {
      this.suggestions = [];
      m.redraw();
    }
  }

  private suggestionMenu(): Mithril.Children {
    return (
      <ul className="chat-composer-autocomplete Dropdown-menu" role="listbox">
        {this.suggestions.map((item, index) => (
          <li
            key={item.key}
            className={classList({ active: index === this.suggestionIndex })}
            role="option"
            aria-selected={index === this.suggestionIndex ? 'true' : 'false'}
          >
            <button
              type="button"
              onmousedown={(e: MouseEvent) => {
                e.preventDefault();
                this.choose(index);
              }}
              onmouseenter={() => (this.suggestionIndex = index)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }
}
