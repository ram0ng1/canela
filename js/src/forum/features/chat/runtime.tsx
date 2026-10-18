/*
 * O chat de verdade: store, gaveta, ícone do cabeçalho, barra lateral e
 * preferências. É um chunk sob demanda: o index.tsx só o pede quando o chat
 * está ligado para o leitor, e um fórum com o chat desligado não baixa nada.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import chat from './ChatStore';
import ChatDrawer from './components/ChatDrawer';
import ChatHeaderIcon from './components/ChatHeaderIcon';
import installChatSidebar, { openChat } from './sidebar';
import installChatPreferences from './preferences';
import { chatRequest, pushUsers } from './utils';

let started = false;

/** Liga o chat depois do primeiro desenho: extensões, gaveta, tempo real e o atalho `-`. */
function start(): void {
  if (started) return;
  started = true;

  installChatSidebar();
  installChatPreferences();

  const outlet = document.createElement('div');
  outlet.className = 'chat-drawer-outlet';
  document.body.appendChild(outlet);
  m.mount(outlet, ChatDrawer);

  chat.start();

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== '-' || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target as HTMLElement;

    if (target.closest('input, textarea, select, [contenteditable]') || app.screen() === 'phone' || chat.isFullPage()) return;

    e.preventDefault();
    if (chat.drawer.open) chat.closeDrawer();
    else chat.openDrawer();
  });

  // As extensões novas (seção da barra, preferências) entram no próximo desenho.
  m.redraw();
}

async function openDirect(user: User): Promise<void> {
  const result = await chatRequest('POST', '/direct-messages', { userIds: [Number(user.id())] });

  pushUsers(result.users);
  const channel = chat.putChannel(result.channel);

  openChat({ name: 'channel', channelId: channel.id });
}

export default { start, openDirect, ChatHeaderIcon };
