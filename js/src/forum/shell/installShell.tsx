/*
 * A casca do Discourse: cabeçalho de largura total com o hambúrguer, o logo e a
 * busca centralizada; barra lateral global à esquerda; e o conteúdo num cartão
 * sobre o fundo tingido.
 *
 * O layout do core (forum.blade.php) não tem onde pôr uma barra lateral global,
 * então ela ganha um <aside> próprio dentro do #app, montado logo depois que o
 * core monta o resto. No celular o mesmo <aside> vira o painel do hambúrguer
 * (o .menu-panel do Discourse), por cima de tudo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import PageStructure from 'flarum/forum/components/PageStructure';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../components/CanelaSidebar';
import HeaderToggle from '../components/HeaderToggle';
import HeaderCenter, { watchHeaderTopic } from './HeaderCenter';
import { watchColoredAccents } from './coloredAccents';
import installShortcuts from './shortcuts';
import extendHeader from './extendHeader';
import installThemePreview from './themePreview';
import installModalLayout from './modalLayout';
import { forumBool, t } from '../utils/settings';
import { SHELL_CLASS, applySidebarState, closeOverlaySidebar, watchViewport } from '../utils/sidebarState';
import { installColorMode } from './colorMode';

/** Páginas em que o hero vai para dentro do cartão, como no Discourse. */
const INLINE_HERO_PAGES = /\b(DiscussionPage|UserPage)\b/;

export default function installShell() {
  // Estende a instância, e não o protótipo: o core 2.0 não exporta a classe
  // ForumApplication no registro de módulos. O initializer roda antes do mount.
  extend(app as any, 'mount', function () {
    const appElement = document.getElementById('app');

    if (!appElement) return;

    const sidebarEnabled = forumBool('canelaSidebarEnabled', true);

    appElement.classList.add(
      ...classList(SHELL_CLASS, {
        'Canela--pillButtons': forumBool('canelaPillButtons', true),
        'Canela--tinted': forumBool('canelaTintedBackground', true),
        'Canela--card': forumBool('canelaContentCard', true),
        'Canela--noSidebar': !sidebarEnabled,
        'Canela--headerSearch': forumBool('canelaHeaderSearch', true),
        'Canela--noEventPosts': !forumBool('canelaTopicEventPosts', true),
        'Canela--stickyAvatar': forumBool('canelaTopicStickyAvatar', false),
        // A linha do tempo ligando os avatares (less/forum/PostDirect.less).
        'Canela--postDirect': app.forum.attribute('canelaPostStyle') === 'direct',
      }).split(' ')
    );

    mountHeader(sidebarEnabled);
    watchColoredAccents();
    installColorMode();

    if (sidebarEnabled) {
      mountSidebar(appElement);
      applySidebarState();
      watchViewport();
    }

    mountBackdrop(appElement);

    if (forumBool('canelaKeyboardShortcuts', true)) installShortcuts();
  });

  extendHeader();
  installThemePreview();
  installModalLayout();
  installInlineHero();
  removeDiscussionPane();
}

/**
 * No celular os menus do painel (Mais, paleta, modo de cor) são a folha que
 * sobe do pé da tela, com `position: fixed`. O Safari do iOS recorta um
 * elemento fixo pelos limites de quem rola por cima dele: com o painel como
 * área de rolagem (`overflow-y: auto`), a folha saía do tamanho do painel, e
 * não da tela. Enquanto um menu está aberto o painel deixa de rolar (a classe
 * tira o overflow) e o conteúdo fica parado onde estava; ao fechar, a rolagem
 * volta para o mesmo ponto.
 */
function keepPanelMenusOnScreen(aside: HTMLElement) {
  const OPEN = 'CanelaSidebar--menuOpen';
  let scrollTop = 0;

  $(aside).on('shown.bs.dropdown', '.Dropdown', () => {
    if (!document.getElementById('app')?.classList.contains('Canela--sidebarOverlay')) return;

    scrollTop = aside.scrollTop;
    aside.style.setProperty('--canela-panel-scroll', `${scrollTop}px`);
    aside.classList.add(OPEN);
  });

  $(aside).on('hidden.bs.dropdown', '.Dropdown', () => {
    if (!aside.classList.contains(OPEN) || aside.querySelector('.Dropdown.open')) return;

    aside.classList.remove(OPEN);
    aside.style.removeProperty('--canela-panel-scroll');
    aside.scrollTop = scrollTop;
  });
}

function mountSidebar(appElement: HTMLElement) {
  const aside = document.createElement('aside');
  aside.id = 'canela-sidebar';
  aside.className = 'CanelaSidebar';
  aside.setAttribute('aria-label', t('sidebar.label'));

  // Depois do link "pular para o conteúdo", que precisa ser o primeiro foco.
  appElement.insertBefore(aside, document.getElementById('app-navigation'));

  m.mount(aside, { view: () => <CanelaSidebar /> });

  keepPanelMenusOnScreen(aside);

  // No painel sobreposto (tablet), escolher um destino fecha o painel.
  aside.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) closeOverlaySidebar();
  });

  // Esc fecha o painel do celular, como o menu do Discourse.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlaySidebar();
  });

  const backdrop = document.createElement('div');
  backdrop.className = 'CanelaSidebar-backdrop';
  backdrop.addEventListener('click', () => closeOverlaySidebar());
  appElement.insertBefore(backdrop, aside.nextSibling);
}

/** As peças coloridas e desfocadas do fundo do meta.discourse.org (.meta-bg-icons). */
const BACKDROP_TILES: [string, string][] = [
  ['plane', 'fas fa-paper-plane'],
  ['chat', 'fas fa-comment-dots'],
  ['quote', 'fas fa-quote-left'],
  ['bell', 'fas fa-bell'],
  ['sparkles', 'fas fa-wand-magic-sparkles'],
  ['reactions', 'fas fa-face-smile'],
];

function mountBackdrop(appElement: HTMLElement) {
  const backdrop = document.createElement('div');
  backdrop.className = 'CanelaBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  appElement.insertAdjacentElement('afterend', backdrop);

  m.render(
    backdrop,
    BACKDROP_TILES.map(([name, icon]) => (
      <div className={`CanelaBackdrop-tile CanelaBackdrop-tile--${name}`}>
        <Icon name={icon} />
      </div>
    ))
  );
}

function mountHeader(sidebarEnabled: boolean) {
  const container = document.querySelector<HTMLElement>('#header > .container');
  const title = container?.querySelector('.Header-title');

  if (!container || !title) return;

  // Os encaixes podem já existir: o script do <head> (recurso `preload`) os cria
  // antes da primeira pintura, para o logo não pular de lugar no boot.
  if (sidebarEnabled) {
    let toggleSlot = container.querySelector<HTMLElement>(':scope > .CanelaHeader-toggleSlot');

    if (!toggleSlot) {
      toggleSlot = document.createElement('div');
      toggleSlot.className = 'CanelaHeader-toggleSlot';
      container.insertBefore(toggleSlot, title);
    }

    m.mount(toggleSlot, HeaderToggle);
  }

  // O meio do cabeçalho existe mesmo sem a busca: é onde o título do tópico
  // aparece ao rolar.
  let centerSlot = container.querySelector<HTMLElement>(':scope > .CanelaHeader-center');

  if (!centerSlot) {
    centerSlot = document.createElement('div');
    centerSlot.className = 'CanelaHeader-search CanelaHeader-center';
    container.insertBefore(centerSlot, document.getElementById('header-secondary'));
  }

  m.mount(centerSlot, HeaderCenter);
  watchHeaderTopic();

  if (!forumBool('canelaShowTitleWithLogo', false)) {
    container.classList.add('CanelaHeader--logoOnly');
  }
}

/**
 * No Discourse o título do tópico e a capa do perfil ficam dentro do cartão,
 * e não sobre o fundo como o hero do Flarum. Em vez de reescrever as páginas,
 * o hero muda de lugar no PageStructure, que todas elas usam.
 */
/**
 * O Discourse não tem o painel lateral com a lista de discussões que o Flarum
 * abre na página do tópico (o "pane"): ele sai do PageStructure e fica
 * desligado, para não aparecer nem ao passar o mouse na borda.
 */
function removeDiscussionPane() {
  override(PageStructure.prototype, 'rootItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    items.remove('pane');

    return items;
  });

  extend(DiscussionPage.prototype, 'oninit', function () {
    app.pane?.disable();
  });
}

function installInlineHero() {
  const isInline = (structure: PageStructure) => INLINE_HERO_PAGES.test(structure.attrs.className || '');

  override(PageStructure.prototype, 'mainItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isInline(this)) items.remove('hero');

    return items;
  });

  override(PageStructure.prototype, 'containerItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isInline(this)) {
      items.add('hero', <div className="Page-hero Page-hero--inline">{(this.attrs.hero && this.attrs.hero()) || null}</div>, 200);
    }

    return items;
  });
}
