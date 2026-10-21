/*
 * A gaveta do ramon/chat como a do chat do tema (chat-drawer):
 * - sem conversa aberta, a lista do tema (a seção "Canais" com o lápis, ou as
 *   MDs) e as abas de baixo, no lugar da lista própria dele;
 * - redimensionável pelo canto de cima à esquerda, com o tamanho guardado no navegador.
 */
import { extend, override } from 'flarum/common/extend';

import { thirdParty } from '../settings';
import { DrawerHome } from './ui';

const SIZE_KEY = 'canela.ramonChat.drawerSize';
const MIN_WIDTH = 250;
const MIN_HEIGHT = 300;

interface DrawerSize {
  width: number;
  height: number;
}

function readSize(): DrawerSize | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');

    return raw && Number(raw.width) > 0 && Number(raw.height) > 0 ? { width: Number(raw.width), height: Number(raw.height) } : null;
  } catch {
    return null;
  }
}

function writeSize(size: DrawerSize): void {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {
    // Sem armazenamento, o tamanho vale até recarregar.
  }
}

/** O tamanho dentro da janela: a gaveta nunca passa do cabeçalho nem da borda esquerda. */
function clamp(size: DrawerSize): DrawerSize {
  return {
    width: Math.max(MIN_WIDTH, Math.min(size.width, window.innerWidth - 40)),
    height: Math.max(MIN_HEIGHT, Math.min(size.height, window.innerHeight - 70)),
  };
}

/** Arrasta o canto: a gaveta cresce para a esquerda e para cima (ela mora no canto de baixo à direita). */
function startResize(e: PointerEvent): void {
  const drawer = (e.currentTarget as HTMLElement).closest('.ChatDrawer') as HTMLElement | null;

  if (!drawer || e.button !== 0) return;

  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const rect = drawer.getBoundingClientRect();
  let size: DrawerSize = { width: rect.width, height: rect.height };

  drawer.classList.add('is-resizing');

  const move = (ev: PointerEvent) => {
    size = clamp({ width: rect.width + (startX - ev.clientX), height: rect.height + (startY - ev.clientY) });
    drawer.style.width = `${size.width}px`;
    drawer.style.height = `${size.height}px`;
  };

  const up = () => {
    drawer.classList.remove('is-resizing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    writeSize(size);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export default function installRamonChatDrawer(): void {
  const PANEL = 'ext:ramon/chat/forum/components/ChatDrawerPanel';

  override(PANEL as any, 'body', function (this: any, original: (channel: unknown) => unknown, channel: unknown) {
    if (channel || !thirdParty.ramonChat()) return original(channel);

    return [m(DrawerHome as any, { key: 'canela-home', onopen: (c: any) => this.select(c) })];
  });

  extend(PANEL as any, 'view', function (vnode: any) {
    if (!thirdParty.ramonChat() || !vnode || typeof vnode !== 'object' || !vnode.attrs) return;

    const className = String(vnode.attrs.className || '');

    if (!className.includes('ChatDrawer') || className.includes('ChatDrawer--collapsed')) return;

    const size = readSize();

    if (size) {
      const fit = clamp(size);
      vnode.attrs.style = { ...(vnode.attrs.style || {}), width: `${fit.width}px`, height: `${fit.height}px` };
    }

    if (!Array.isArray(vnode.children)) return;

    vnode.children.push(m('div', { className: 'chat-drawer-resizer', onpointerdown: startResize, 'aria-hidden': 'true' }));
  });
}
