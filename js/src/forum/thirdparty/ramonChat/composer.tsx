/*
 * O editor do chat como o do chat do tema (chat-composer): o anexo vira o "+"
 * redondo à esquerda do texto (no CSS, pela ordem) e entra o botão de emoji
 * antes do enviar, com o mesmo seletor do editor de posts (o chunk
 * composer/emoji). O emoji entra no cursor pelo `insertAtCursor` do próprio
 * ramon/chat, que atualiza o rascunho e o tamanho da caixa.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';

import { thirdParty } from '../settings';
import { openEmojiPicker, preloadEmojiPicker } from '../../features/composer/emoji/pickerLazy';
import { findByClass } from './views';

/** Acha o vnode de componente com este `icon` (o Button do anexo mora num fragmento). */
function findByIcon(node: any, icon: string): any {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByIcon(child, icon);
      if (found) return found;
    }

    return null;
  }

  if (node.attrs?.icon === icon) return node;

  return findByIcon(node.children, icon);
}

export default function installRamonChatComposer(): void {
  extend('ext:ramon/chat/forum/components/ChatComposer' as any, 'view', function (this: any, vnode: any) {
    if (!thirdParty.ramonChat() || !vnode || typeof vnode !== 'object') return;

    const attach = findByIcon(vnode, 'fas fa-paperclip');

    if (attach) {
      attach.attrs.icon = 'fas fa-plus';
      attach.attrs.className = `${attach.attrs.className || ''} ChatComposer-attach`;
    }

    const bar = findByClass(vnode, 'ChatComposer-bar');

    if (!bar || !Array.isArray(bar.children)) return;

    const send = bar.children.findIndex((child: any) => String(child?.attrs?.className || '').includes('ChatComposer-send'));
    const label = app.translator.trans('ramon-canela.forum.chat.emoji', {}, true) as string;
    const disabled = !!this.sending;

    const emoji = (
      <button
        type="button"
        className="ChatComposer-tool ChatComposer-emoji"
        title={label}
        aria-label={label}
        disabled={disabled}
        onpointerenter={() => preloadEmojiPicker()}
        onclick={(e: MouseEvent) =>
          openEmojiPicker(e.currentTarget as HTMLElement, (char: string) => {
            this.insertAtCursor?.(char);
            m.redraw();
          })
        }
      >
        <Icon name="far fa-face-smile" />
      </button>
    );

    bar.children.splice(send === -1 ? bar.children.length : send, 0, emoji);
  });
}
