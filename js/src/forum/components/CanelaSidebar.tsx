import app from 'flarum/forum/app';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Dropdown from 'flarum/common/components/Dropdown';
import Separator from 'flarum/common/components/Separator';
import ItemList from 'flarum/common/utils/ItemList';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import SidebarSection from './SidebarSection';
import DraftsMenu, { showDraftsMenu } from '../features/composer/drafts/DraftsMenu';
import { FooterColorMode, FooterPaletteSelector } from '../shell/colorMode';
import { getCommunityMore, getCommunityOrder, getSidebarPicks, type SidebarSectionName } from '../utils/sidebarPrefs';
import { forumBool, forumInt, isExtensionEnabled, t } from '../utils/settings';
import {
  allTags,
  categoriesUrl,
  categorySymbol,
  currentTag,
  isTagsEnabled,
  primaryTags,
  secondaryTags,
  sortTags,
  tagSymbol,
  tagUrl,
  type CanelaTag,
} from '../utils/tags';

/** Itens que o flarum/tags põe na navegação do IndexSidebar: aqui eles têm seções próprias. */
const TAG_NAV_KEYS = /^(tags|separator|moreTags|tag\d+)$/;

/**
 * A barra lateral: botão "Iniciar Discussão", a seção da comunidade
 * (Tópicos, Minhas postagens, Mais…), as categorias e as etiquetas, e um
 * rodapé com o tema claro/escuro e os atalhos de teclado.
 *
 * Herda do IndexSidebar para receber de graça o que as extensões põem na
 * navegação da página inicial — Seguindo, por exemplo —, com o `active` que o
 * LinkButton já calcula.
 */
export default class CanelaSidebar extends IndexSidebar {
  view(): Mithril.Children {
    return (
      <div className="CanelaSidebar-inner">
        <div className="CanelaSidebar-sections">{this.sectionItems().toArray()}</div>
        {forumBool('canelaSidebarFooter', true) && <div className="CanelaSidebar-footer">{this.footerItems().toArray()}</div>}
      </div>
    );
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    // O botão só aparece para quem está logado (o visitante
    // tem o "Entrar" do cabeçalho). O admin pode escondê-lo de vez.
    if (app.session.user && forumBool('canelaSidebarNewTopic', true)) items.add('newTopic', this.newTopicButton(), 100);

    items.add('community', <SidebarSection name="community">{listItems(this.communitySection().toArray())}</SidebarSection>, 90);

    if (isTagsEnabled() && forumBool('canelaSidebarCategories', true)) {
      const categories = this.categoryItems();

      if (!categories.isEmpty()) {
        items.add(
          'categories',
          <SidebarSection name="categories" title={t('sidebar.categories')} {...this.editAttrs('categories')}>
            {listItems(categories.toArray())}
          </SidebarSection>,
          80
        );
      }
    }

    if (isTagsEnabled() && forumBool('canelaSidebarTags', true)) {
      const tags = this.tagItems();

      if (!tags.isEmpty()) {
        items.add(
          'tags',
          <SidebarSection name="tags" title={t('sidebar.tags')} {...this.editAttrs('tags')}>
            {listItems(tags.toArray())}
          </SidebarSection>,
          70
        );
      }
    }

    return items;
  }

  /** O lápis de personalizar a seção. */
  /** Personalizar a barra lateral é só para quem está logado: visitante não vê o lápis. */
  editAttrs(section: SidebarSectionName) {
    if (!app.session.user) return {};

    return {
      editLabel: t(section === 'categories' ? 'sidebar.customize_categories' : 'sidebar.customize_tags'),
      onEdit: () => app.modal.show(() => import('./SidebarCustomizeModal'), { section }),
    };
  }

  /** As tags escolhidas pelo leitor para a seção, na ordem do fórum. */
  pickedTags(section: SidebarSectionName): CanelaTag[] | null {
    const picks = getSidebarPicks(section);

    if (!picks) return null;

    const ids = new Set(picks);

    return sortTags(allTags().filter((tag) => ids.has(tag.id()!)));
  }

  newTopicButton(): Mithril.Children {
    const tag = currentTag() as (CanelaTag & { canStartDiscussion?: () => boolean }) | null;
    const canStart = !app.session.user || (tag?.canStartDiscussion ? tag.canStartDiscussion() : !!app.forum.attribute('canStartDiscussion'));

    // Com rascunhos (fof/drafts), o botão vira um botão dividido:
    // "✎ Novo tópico" e o "⌄" com a lista de rascunhos.
    const split = showDraftsMenu();

    return (
      <div className={classList('CanelaSidebar-newTopic', split && 'CanelaSidebar-newTopic--split')}>
        <Button
          className="Button Button--primary CanelaSidebar-newTopicButton"
          icon="fas fa-pen-to-square"
          disabled={!canStart}
          onclick={() => this.newDiscussionAction().catch(() => {})}
        >
          {t('sidebar.new_topic')}
        </Button>
        {split && <DraftsMenu />}
      </div>
    );
  }

  communityItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = app.session.user;
    const params = app.search.state.stickyParams();

    items.add(
      'topics',
      <LinkButton href={app.route('index', params)} icon="fas fa-layer-group" active={this.isIndexActive()}>
        {t('sidebar.topics')}
      </LinkButton>,
      100
    );

    // O que as outras extensões põem na navegação (Seguindo, por exemplo),
    // menos a lista de tags, que aqui tem seção própria.
    const extensionItems = this.navItems();

    extensionItems.remove('allDiscussions');

    Object.entries(extensionItems.toObject()).forEach(([key, item]) => {
      if (!TAG_NAV_KEYS.test(key)) items.add(key, item.content as Mithril.Children, item.priority);
    });

    if (user) {
      items.add(
        'myPosts',
        <LinkButton href={app.route('user.posts', { username: user.slug() })} icon="far fa-user">
          {t('sidebar.my_posts')}
        </LinkButton>,
        60
      );

      if (isExtensionEnabled('flarum-messages')) {
        items.add(
          'myMessages',
          <LinkButton href={app.route('messages')} icon="fas fa-inbox">
            {t('sidebar.my_messages')}
          </LinkButton>,
          55
        );
      }

      if (user.isAdmin()) {
        items.add(
          'admin',
          <LinkButton href={app.forum.attribute<string>('adminUrl')} icon="fas fa-wrench" external={true} target="_self">
            {t('sidebar.admin')}
          </LinkButton>,
          50
        );
      }
    }

    items.add('more', this.moreDropdown(), -100);

    return items;
  }

  /**
   * A seção principal depois de todas as extensões terem posto os seus itens:
   * na ordem que o leitor escolheu, os que ele mandou esconder vão para dentro
   * do "Mais", e o "Mais" ganha o "Personalizar" com a lista de todos eles.
   */
  communitySection(): ItemList<Mithril.Children> {
    const items = this.communityItems();
    const hidden = new Set(getCommunityMore());
    const entries: { key: string; label: string; icon?: string }[] = [];
    const moved: { key: string; vnode: Mithril.Children }[] = [];

    // A ordem escolhida fica acima de todas as prioridades do código; o que
    // não está nela (um item novo) vem depois, na posição de sempre.
    getCommunityOrder().forEach((key, index) => {
      if (key !== 'more' && items.has(key)) items.setPriority(key, 10000 - index);
    });

    // Na ordem em que aparecem (a do toArray, por prioridade), não na ordem em
    // que o código os adicionou: é a que o modal mostra e a do "Mais".
    const keys = items.toArray().map((item) => item.itemName);

    keys.forEach((key) => {
      if (key === 'more') return;

      const vnode = items.get(key) as any;

      entries.push({ key, label: vnodeText(vnode) || key, icon: vnode?.attrs?.icon });

      // O item ativo nunca some: quem está na página vê onde está.
      if (hidden.has(key) && vnode?.attrs?.active !== true && vnode?.attrs?.active !== 'true') {
        moved.push({ key, vnode });
        items.remove(key);
      }
    });

    if (items.has('more')) items.setContent('more', this.moreDropdown(moved, entries));

    return items;
  }

  /** "Tópicos" fica ativo na página inicial sem filtro de tag nem de "Seguindo". */
  isIndexActive(): boolean {
    const routeName = app.current.get('routeName');

    return routeName === 'index' && !currentTag();
  }

  moreItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    if (isTagsEnabled()) {
      items.add(
        'categories',
        <LinkButton href={categoriesUrl()} icon="fas fa-table-cells-large">
          {t('sidebar.all_categories')}
        </LinkButton>,
        100
      );
    }

    if (app.session.user) {
      items.add(
        'notifications',
        <LinkButton href={app.route('notifications')} icon="far fa-bell">
          {t('sidebar.notifications')}
        </LinkButton>,
        90
      );
      items.add(
        'settings',
        <LinkButton href={app.route('settings')} icon="fas fa-gear">
          {t('sidebar.settings')}
        </LinkButton>,
        80
      );
    }

    items.add(
      'shortcuts',
      <Button icon="far fa-keyboard" onclick={() => app.modal.show(() => import('./KeyboardShortcutsModal'))}>
        {t('sidebar.keyboard_shortcuts')}
      </Button>,
      10
    );

    return items;
  }

  moreDropdown(
    moved: { key: string; vnode: Mithril.Children }[] = [],
    entries: { key: string; label: string; icon?: string }[] = []
  ): Mithril.Children {
    const more = this.moreItems();

    // Os itens mandados para cá vêm primeiro, na ordem da barra, e um traço os
    // separa dos de sempre. Tudo na mesma ItemList: o Dropdown dá a cada item
    // a `key` do nome dele, e um vnode solto (sem nome) no meio fazia o
    // Mithril recusar a lista ("vnodes must either all have keys or none") —
    // a barra quebrava e o "Mais" sumia, a cada página, até limpar a escolha.
    moved.forEach(({ key, vnode }, index) => more.add(key, vnode, 1000 - index));

    if (moved.length) more.add('movedSeparator', <Separator />, 500);

    if (entries.length && app.session.user) {
      more.add(
        'customizeCommunity',
        <Button icon="fas fa-pencil" onclick={() => app.modal.show(() => import('./CommunityCustomizeModal'), { entries, onsave: () => m.redraw() })}>
          {t('sidebar.customize_community')}
        </Button>,
        5
      );
    }

    return (
      <Dropdown
        className="CanelaSidebar-more"
        buttonClassName="CanelaSidebar-moreButton"
        icon="fas fa-ellipsis-vertical"
        label={t('sidebar.more')}
        caretIcon={null}
        accessibleToggleLabel={t('sidebar.more')}
        onshow={() => placeMoreMenu()}
      >
        {more.toArray()}
      </Dropdown>
    );
  }

  categoryItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const active = currentTag();
    const activeRoot = active && active.isChild() ? (active.parent() as CanelaTag) : active;

    (this.pickedTags('categories') ?? primaryTags()).forEach((tag, index) => {
      items.add(`category${tag.id()}`, this.tagLink(tag, categorySymbol(tag, 'CanelaSidebar-linkIcon'), activeRoot === tag), 100 - index);
    });

    items.add(
      'allCategories',
      <LinkButton className="CanelaSidebar-link--all" href={categoriesUrl()} icon="fas fa-list">
        {t('sidebar.all_categories')}
      </LinkButton>,
      -100
    );

    return items;
  }

  tagItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const active = currentTag();
    const limit = forumInt('canelaSidebarTagsLimit', 6);
    const picked = this.pickedTags('tags');
    const tags = picked ?? secondaryTags().slice(0, limit);

    tags.forEach((tag, index) => {
      items.add(`tag${tag.id()}`, this.tagLink(tag, tagSymbol(tag, 'CanelaSidebar-linkIcon', 'fas fa-tag'), active === tag), 100 - index);
    });

    if (tags.length) {
      items.add(
        'allTags',
        <LinkButton className="CanelaSidebar-link--all" href={app.route('tags')} icon="fas fa-list">
          {t('sidebar.all_tags')}
        </LinkButton>,
        -100
      );
    }

    return items;
  }

  tagLink(tag: CanelaTag, icon: Mithril.Children, active: boolean): Mithril.Children {
    return (
      <Link
        className={classList('LinkButton CanelaSidebar-tagLink', { active })}
        href={tagUrl(tag)}
        active={String(active)}
        title={tag.description() || undefined}
      >
        {icon}
        <span className="Button-label">{tag.name()}</span>
      </Link>
    );
  }

  footerItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    // A paleta à esquerda e o modo de cor, no rodapé.
    if (app.allowUserColorScheme) {
      items.add('palette', <FooterPaletteSelector />, 110);
      items.add('theme', <FooterColorMode />, 100);
    }

    // O "+" do rodapé, só para quem está logado.
    if (app.session.user)
      items.add(
        'newTopic',
        <Button
          className="Button Button--icon Button--flat"
          icon="fas fa-plus"
          aria-label={t('sidebar.new_topic')}
          title={t('sidebar.new_topic')}
          onclick={() => this.newDiscussionAction().catch(() => {})}
        />,
        90
      );

    items.add(
      'shortcuts',
      <Button
        className="Button Button--icon Button--flat CanelaSidebar-footerShortcuts"
        icon="far fa-keyboard"
        aria-label={t('sidebar.keyboard_shortcuts')}
        title={t('sidebar.keyboard_shortcuts')}
        onclick={() => app.modal.show(() => import('./KeyboardShortcutsModal'))}
      />,
      80
    );

    return items;
  }
}

/** O texto de um item da barra (o rótulo do LinkButton), para a lista do "Personalizar". */
function vnodeText(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(vnodeText).join('');
  // O contador ao lado do rótulo (rascunhos, não lidas) não entra.
  if (typeof node.attrs?.className === 'string' && /count|suffix/i.test(node.attrs.className)) return '';

  return vnodeText(node.children ?? node.text);
}

/**
 * O menu do "Mais" abre para FORA da barra lateral: a barra rola (overflow) e
 * cortava o menu. Com position: fixed ele sai dela, colado ao botão, com uma
 * setinha apontando para o "Mais" (como um submenu), e sobe se não couber até
 * o fim da tela. No celular, é a folha que sobe do pé da tela.
 */
function placeMoreMenu(): void {
  requestAnimationFrame(() => {
    const toggle = document.querySelector<HTMLElement>('.CanelaSidebar-more.open .CanelaSidebar-moreButton');
    const menu = document.querySelector<HTMLElement>('.CanelaSidebar-more.open .Dropdown-menu');

    if (!toggle || !menu) return;

    // No celular o menu é a folha que sobe do pé da tela, como os outros
    // menus (o CSS do core cuida disso): sem posição calculada aqui.
    if (window.innerWidth < 768) {
      menu.classList.remove('CanelaSidebar-moreMenu--side');
      ['position', 'top', 'right', 'bottom', 'left', '--canela-more-arrow'].forEach((prop) => menu.style.removeProperty(prop));

      return;
    }

    const rect = toggle.getBoundingClientRect();

    menu.classList.add('CanelaSidebar-moreMenu--side');
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.top = '0px';
    menu.style.left = `${rect.right + 10}px`;

    const height = menu.offsetHeight;
    const wanted = rect.top + rect.height / 2 - 22;
    const top = Math.max(8, Math.min(wanted, window.innerHeight - height - 8));

    menu.style.top = `${top}px`;
    // A setinha fica na altura do meio do botão, mesmo que o menu tenha subido.
    menu.style.setProperty('--canela-more-arrow', `${rect.top + rect.height / 2 - top}px`);
  });
}
