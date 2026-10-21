/*
 * As ações de uma mensagem.
 *
 * - No computador, a barrinha que aparece no canto ao passar o mouse
 *   (chat-message-actions-desktop): as três reações rápidas, "Reagir",
 *   "Responder" e o menu "…" com copiar link, editar, fixar, excluir,
 *   restaurar.
 * - No celular, a folha que sobe ao segurar a mensagem
 *   (chat-message-actions-mobile), com as mesmas ações em botões grandes.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat, { type ChatPane } from '../ChatStore';
import { setMenuOpen } from './ChatMessage';
import { channelPath, chatRequest, copyText, ct, emoji, meId, pushUsers, quickReactions } from '../utils';
import { openEmojiPicker } from '../../composer/emoji/pickerLazy';
import type { ChatMessage } from '../types';

export interface MessageActionsAttrs extends ComponentAttrs {
  message: ChatMessage;
  pane: ChatPane;
  context: string;
  hidden?: boolean;
}

interface SecondaryAction {
  id: string;
  icon: string;
  label: string;
  run: () => void;
}

/** O que o leitor pode fazer com a mensagem. */
export function secondaryActions(message: ChatMessage, pane: ChatPane, phone = false): SecondaryAction[] {
  const channel = pane.channel;
  const mine = message.userId === meId();
  const canPost = !!channel?.canPost;
  const actions: SecondaryAction[] = [];

  actions.push({ id: 'copyLink', icon: 'fas fa-link', label: ct('copy_link'), run: () => copyLink(message, pane) });

  if (phone)
    actions.push({
      id: 'copyText',
      icon: 'far fa-clipboard',
      label: ct('copy_text'),
      run: () => copyText(message.message).then(() => app.alerts.show({ type: 'success' }, ct('text_copied'))),
    });

  if (mine && canPost && !message.deletedAt)
    actions.push({ id: 'edit', icon: 'fas fa-pencil', label: ct('edit'), run: () => pane.startEdit(message) });

  if (channel?.canPin && !message.deletedAt) {
    actions.push(
      message.pinned
        ? { id: 'unpin', icon: 'fas fa-thumbtack', label: ct('unpin_message'), run: () => pin(message, false) }
        : { id: 'pin', icon: 'fas fa-thumbtack', label: ct('pin_message'), run: () => pin(message, true) }
    );
  }

  const canDelete = !message.deletedAt && (channel?.canModerate || (mine && channel?.status === 'open' && canPost));

  if (canDelete) actions.push({ id: 'delete', icon: 'far fa-trash-can', label: ct('delete'), run: () => remove(message) });

  const canRestore = !!message.deletedAt && (channel?.canModerate || (mine && message.deletedById === meId()));

  if (canRestore) actions.push({ id: 'restore', icon: 'fas fa-arrow-rotate-left', label: ct('restore'), run: () => restore(message) });

  return actions;
}

function messageUrl(message: ChatMessage, pane: ChatPane): string {
  const channel = pane.channel;
  const base = channel ? channelPath(channel) : `/chat/c/-/${message.channelId}`;
  const path = pane.threadId ? `${base}/t/${pane.threadId}/${message.id}` : `${base}/${message.id}`;

  return window.location.origin + path;
}

function copyLink(message: ChatMessage, pane: ChatPane): void {
  copyText(messageUrl(message, pane)).then(() => app.alerts.show({ type: 'success' }, ct('link_copied')));
}

async function pin(message: ChatMessage, value: boolean): Promise<void> {
  const result = await chatRequest(value ? 'POST' : 'DELETE', `/messages/${message.id}/pin`);

  pushUsers(result.users);
  chat.upsertEverywhere(result.message);
}

async function remove(message: ChatMessage): Promise<void> {
  const result = await chatRequest('DELETE', `/messages/${message.id}`);

  pushUsers(result.users);
  chat.upsertEverywhere(result.message);
}

async function restore(message: ChatMessage): Promise<void> {
  const result = await chatRequest('POST', `/messages/${message.id}/restore`);

  pushUsers(result.users);
  chat.upsertEverywhere({ ...result.message, expanded: false });
}

function reply(message: ChatMessage, pane: ChatPane): void {
  pane.startReply(message);
}

export default class MessageActions extends Component<MessageActionsAttrs> {
  view(): Mithril.Children {
    const { message, pane } = this.attrs;
    const canPost = !!pane.channel?.canPost && !message.staged;
    const secondary = secondaryActions(message, pane);
    const me = meId();

    return (
      <div className={classList('chat-message-actions-container', 'is-size-full')} data-id={message.id}>
        <div
          className={classList('chat-message-actions', { 'has-no-secondary-actions': !secondary.length })}
          role="toolbar"
          aria-label={ct('message_actions')}
        >
          {canPost &&
            quickReactions().map((char) => {
              const reaction = message.reactions.find((r) => r.emoji === char);
              const reacted = !!reaction?.userIds.includes(me);

              return (
                <button
                  type="button"
                  className={classList('chat-message-reaction', { reacted })}
                  title={reacted ? ct('reactions.remove', { emoji: char }) : ct('reactions.add', { emoji: char })}
                  onclick={() => chat.react(message, char)}
                >
                  {emoji(char)}
                </button>
              );
            })}

          {canPost && (
            <button
              type="button"
              className="Button Button--flat react-btn"
              title={ct('react')}
              aria-label={ct('react')}
              onclick={(e: MouseEvent) => {
                setMenuOpen(message.id);
                openEmojiPicker(e.currentTarget as HTMLElement, (char) => {
                  setMenuOpen(null);
                  chat.react(message, char, true);
                });
              }}
            >
              <Icon name="far fa-face-smile" />
            </button>
          )}

          {canPost && (
            <button
              type="button"
              className="Button Button--flat reply-btn"
              title={ct('reply')}
              aria-label={ct('reply')}
              onclick={() => reply(message, pane)}
            >
              <Icon name="fas fa-reply" />
            </button>
          )}

          {secondary.length > 0 && (
            <Dropdown
              className="more-buttons secondary-actions more-actions-chat"
              buttonClassName="Button Button--icon Button--flat"
              menuClassName="Dropdown-menu--right"
              icon="fas fa-ellipsis-vertical"
              caretIcon={null}
              accessibleToggleLabel={ct('more_message_actions')}
              onshow={() => setMenuOpen(message.id)}
              onhide={() => setMenuOpen(null)}
            >
              {secondary.map((action) => (
                <Button icon={action.icon} className={`chat-message-action --${action.id}`} onclick={() => action.run()}>
                  {action.label}
                </Button>
              ))}
            </Dropdown>
          )}
        </div>
      </div>
    );
  }

  /** A folha do celular, aberta ao segurar a mensagem. */
  static openSheet(message: ChatMessage, pane: ChatPane, _context: string): void {
    const portal = document.createElement('div');

    portal.className = 'chat-message-actions-mobile-outlet';
    document.body.appendChild(portal);

    let closing = false;

    const close = () => {
      if (closing) return;
      closing = true;
      portal.classList.add('is-closing');

      setTimeout(() => {
        m.mount(portal, null);
        portal.remove();
      }, 180);
    };

    const run = (fn: () => void) => () => {
      close();
      fn();
    };

    const canPost = !!pane.channel?.canPost && !message.deletedAt;
    const me = meId();

    m.mount(portal, {
      view: () => (
        <div className="chat-message-actions-backdrop" onclick={close}>
          <div className="chat-message-actions" role="dialog" onclick={(e: Event) => e.stopPropagation()}>
            <div className="selected-message-container">
              <div className="selected-message">
                <span className="selected-message-reply">{message.excerpt}</span>
              </div>
            </div>
            {canPost && (
              <div className="main-actions">
                {quickReactions().map((char) => (
                  <button
                    type="button"
                    className={classList('chat-message-reaction', {
                      reacted: !!message.reactions.find((r) => r.emoji === char)?.userIds.includes(me),
                    })}
                    onclick={run(() => chat.react(message, char))}
                  >
                    {emoji(char)}
                  </button>
                ))}
                <button
                  type="button"
                  className="Button Button--flat react-btn"
                  aria-label={ct('react')}
                  onclick={(e: MouseEvent) => {
                    const anchor = e.currentTarget as HTMLElement;
                    openEmojiPicker(anchor, (char) => {
                      close();
                      chat.react(message, char, true);
                    });
                  }}
                >
                  <Icon name="far fa-face-smile" />
                </button>
                <button type="button" className="Button Button--flat reply-btn" aria-label={ct('reply')} onclick={run(() => reply(message, pane))}>
                  <Icon name="fas fa-reply" />
                </button>
              </div>
            )}
            <ul className="secondary-actions">
              {secondaryActions(message, pane, true).map((action) => (
                <li className="chat-message-action-item">
                  <button type="button" className="chat-message-action" onclick={run(action.run)}>
                    <Icon name={action.icon} />
                    <span>{action.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    });
  }
}
