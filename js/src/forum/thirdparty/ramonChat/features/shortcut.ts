/*
 * (4) O atalho "-" do Discourse: abre e fecha a gaveta do chat. O ramon/chat
 * só tem Alt+C. Fora dos campos de texto, fora da página cheia do chat e
 * fora do celular (lá a gaveta é a tela inteira).
 */
import app from 'flarum/forum/app';

import { chatState, feature, isPhone, ramonModule } from './flags';

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== '-' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  if (!feature('drawer_shortcut') || !app.session.user || isPhone()) return;

  const target = e.target as HTMLElement | null;

  if (target?.closest?.('input, textarea, select, [contenteditable]') || target?.isContentEditable) return;
  if (document.body.classList.contains('ChatFullPage')) return;
  if (!app.forum.attribute<boolean>('canUseChat') || app.session.user.preferences()?.['ramon-chat.enabled'] === false) return;

  const state = chatState();
  const drawer = ramonModule<any>('forum/components/ChatDrawer');
  const ChatDrawer = drawer?.default ?? drawer;

  if (!state || !ChatDrawer) return;

  e.preventDefault();

  if (state.drawerOpen) state.setDrawerOpen(false);
  else ChatDrawer.open?.()?.catch?.(() => {});

  m.redraw();
}

export default function installDrawerShortcut(): void {
  document.addEventListener('keydown', onKeyDown);
}
