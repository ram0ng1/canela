/*
 * Barra lateral aberta ou fechada, como o botão de hambúrguer do Discourse.
 *
 * Do tablet para cima (≥ 768px, como no Discourse) ela fica encaixada ao lado do conteúdo, e a escolha do
 * leitor vai para o localStorage; enquanto ele não escolheu, vale o padrão do
 * admin. No celular ela vira o painel do hambúrguer, por cima do conteúdo,
 * que começa fechado a cada página.
 */
import { forumBool } from './settings';

const STORAGE_KEY = 'canela.sidebarOpen';
const DOCKED_QUERY = '(min-width: 768px)';

export const SHELL_CLASS = 'Canela';
export const OPEN_CLASS = 'Canela--sidebarOpen';
export const OVERLAY_CLASS = 'Canela--sidebarOverlay';

let dockedChoice: boolean | null = null;
let overlayOpen = false;

function readStoredChoice(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored === null ? null : stored === '1';
  } catch {
    return null;
  }
}

export function isDocked(): boolean {
  return window.matchMedia(DOCKED_QUERY).matches;
}

export function isSidebarOpen(): boolean {
  if (!isDocked()) return overlayOpen;

  if (dockedChoice === null) {
    dockedChoice = readStoredChoice() ?? forumBool('canelaSidebarOpenDefault', true);
  }

  return dockedChoice;
}

export function applySidebarState(): void {
  const app = document.getElementById('app');

  if (!app) return;

  app.classList.toggle(OPEN_CLASS, isSidebarOpen());
  app.classList.toggle(OVERLAY_CLASS, !isDocked() && overlayOpen);

  // Painel fechado com um menu aberto (navegou, Esc): a rolagem volta ao normal.
  if (!overlayOpen) {
    const aside = document.getElementById('canela-sidebar');

    aside?.classList.remove('CanelaSidebar--menuOpen');
    aside?.style.removeProperty('--canela-panel-scroll');
  }
}

export function toggleSidebar(): void {
  if (isDocked()) {
    dockedChoice = !isSidebarOpen();

    try {
      localStorage.setItem(STORAGE_KEY, dockedChoice ? '1' : '0');
    } catch {
      // Sem armazenamento a escolha vale só até recarregar a página.
    }
  } else {
    overlayOpen = !overlayOpen;
  }

  applySidebarState();
}

/** Fecha o painel sobreposto — ao navegar ou clicar fora dele. */
export function closeOverlaySidebar(): void {
  if (!overlayOpen) return;

  overlayOpen = false;
  applySidebarState();
}

export function watchViewport(): void {
  window.matchMedia(DOCKED_QUERY).addEventListener('change', () => {
    overlayOpen = false;
    applySidebarState();
  });
}
