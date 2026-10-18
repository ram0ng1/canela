/*
 * Atalhos de teclado do Discourse que fazem sentido no Flarum.
 *
 * Sequências de duas teclas ("g h") esperam a segunda por um instante, como no
 * Discourse. Nada dispara enquanto se digita num campo ou com um modal aberto.
 */
import app from 'flarum/forum/app';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';

import { toggleSidebar } from '../utils/sidebarState';

export interface Shortcut {
  keys: string[];
  action: string;
}

export interface ShortcutGroup {
  name: string;
  shortcuts: Shortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    name: 'jump_to',
    shortcuts: [
      { keys: ['g h'], action: 'home' },
      { keys: ['g l'], action: 'latest' },
      { keys: ['g t'], action: 'top' },
      { keys: ['g c'], action: 'categories' },
      { keys: ['g n'], action: 'notifications' },
      { keys: ['g p'], action: 'profile' },
      { keys: ['g s'], action: 'settings' },
    ],
  },
  {
    name: 'navigation',
    shortcuts: [
      { keys: ['j', 'k'], action: 'next_prev_topic' },
      { keys: ['o', 'Enter'], action: 'open_topic' },
      { keys: ['u'], action: 'back' },
      { keys: ['='], action: 'sidebar' },
    ],
  },
  {
    name: 'application',
    shortcuts: [
      { keys: ['c'], action: 'create' },
      { keys: ['r'], action: 'reply' },
      { keys: ['/', 's'], action: 'search' },
      { keys: ['?'], action: 'help' },
    ],
  },
];

/** Quanto tempo a segunda tecla de uma sequência ("g …") pode demorar. */
const SEQUENCE_TIMEOUT_MS = 1000;

const SELECTED_CLASS = 'CanelaSelected';

let pendingPrefix: string | null = null;
let prefixTimer: number | undefined;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]');
}

function go(url: string) {
  m.route.set(url);
}

function openSearch() {
  // O campo visível: o do cabeçalho, o do banner ou, no celular, o do drawer.
  const button = Array.from(document.querySelectorAll<HTMLElement>('.Search-input, .CanelaHeaderSearch')).find((el) => el.offsetParent !== null);

  button?.click();
}

/** j/k: anda pelos tópicos da lista destacando o atual, como o Discourse. */
function moveSelection(step: number) {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.DiscussionList-discussions > li'));

  if (!items.length) return;

  const current = items.findIndex((item) => item.classList.contains(SELECTED_CLASS));
  const next = Math.min(items.length - 1, Math.max(0, current === -1 ? 0 : current + step));

  items.forEach((item) => item.classList.remove(SELECTED_CLASS));
  items[next].classList.add(SELECTED_CLASS);
  items[next].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function openSelection(): boolean {
  const link = document.querySelector<HTMLAnchorElement>(`.DiscussionList-discussions > li.${SELECTED_CLASS} a.DiscussionListItem-main`);

  if (!link) return false;

  link.click();

  return true;
}

function runSequence(prefix: string, key: string) {
  if (prefix !== 'g') return;

  const user = app.session.user;

  switch (key) {
    case 'h':
      return go(app.route('index'));
    case 'l':
      return go(app.route('index', { sort: 'latest' }));
    case 't':
      return go(app.route('index', { sort: 'top' }));
    case 'c':
      if ('flarum-tags' in flarum.extensions) go(app.route('tags'));
      return;
    case 'n':
      if (user) go(app.route('notifications'));
      return;
    case 'p':
      if (user) go(app.route.user(user));
      return;
    case 's':
      if (user) go(app.route('settings'));
      return;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target) || app.modal.isModalOpen()) return;

  const key = event.key;

  if (pendingPrefix) {
    const prefix = pendingPrefix;
    pendingPrefix = null;
    window.clearTimeout(prefixTimer);
    event.preventDefault();
    runSequence(prefix, key.toLowerCase());
    return;
  }

  switch (key) {
    case 'g':
      pendingPrefix = 'g';
      prefixTimer = window.setTimeout(() => (pendingPrefix = null), SEQUENCE_TIMEOUT_MS);
      return;
    case '/':
    case 's':
      event.preventDefault();
      openSearch();
      return;
    case '?':
      event.preventDefault();
      app.modal.show(() => import('../components/KeyboardShortcutsModal'));
      return;
    case '=':
      toggleSidebar();
      return;
    case 'c':
      event.preventDefault();
      IndexSidebar.prototype.newDiscussionAction().catch(() => {});
      return;
    case 'r': {
      const discussion = app.current.matches(DiscussionPage) ? app.current.get('discussion') : null;

      if (!discussion) return;

      event.preventDefault();
      DiscussionControls.replyAction.call(discussion, true, false).catch(() => {});
      return;
    }
    case 'j':
    case 'k':
      if (app.current.matches(IndexPage)) moveSelection(key === 'j' ? 1 : -1);
      return;
    case 'o':
    case 'Enter':
      if (app.current.matches(IndexPage) && openSelection()) event.preventDefault();
      return;
    case 'u':
      if (app.history.canGoBack()) app.history.back();
      return;
  }
}

export default function installShortcuts() {
  document.addEventListener('keydown', onKeydown);
}
