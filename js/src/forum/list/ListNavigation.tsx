/*
 * A barra de navegação da lista:
 * dropdowns de categoria/etiqueta, as abas de ordenação (Recentes, Em alta,
 * Novos, Não lidos, Melhores…), o link de Categorias, os botões de ação e o
 * "Iniciar Discussão". Fica grudada no topo do cartão ao rolar.
 *
 * Substitui só o item `toolbar` do IndexPage: o que extensões põem em
 * viewItems/actionItems/toolbarItems continua aqui dentro.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import {
  categoriesRouteName,
  categoriesUrl,
  categorySymbol,
  currentTag,
  isTagsEnabled,
  primaryTags,
  secondaryTags,
  sortTags,
  tagSymbol,
  type CanelaTag,
} from '../utils/tags';
import { CORE_SORTS, activeSort, sortLabel } from './sorts';
import SelectKit from '../composer/SelectKit';
import { currentSortRoute, routeForSort } from './routes';

export interface ListNavigationAttrs extends ComponentAttrs {
  /** A página que fornece viewItems/actionItems — ausente na página de categorias. */
  page?: IndexPage;
}

/** Ordenações do core que não viram aba: ficam no menu "mais". */
const OVERFLOW_SORTS = ['oldest', 'az', 'za'];

interface NavTab {
  key: string;
  label: Mithril.Children;
  href: string;
  active: boolean;
}

function onIndex(): boolean {
  return app.current.matches(IndexPage);
}

/** URL da lista na ordenação pedida, mantendo tag/filtros da página atual. */
function sortHref(sort: string): string {
  const index = onIndex();
  const params: Record<string, any> = index ? { ...app.search.state.params() } : {};
  let routeName = index ? app.current.get('routeName') || 'index' : 'index';

  // Na lista geral, as abas levam aos endereços próprios (/latest, /hot,
  // /top…), com a ordenação na própria rota.
  const sortRoute = forumBool('canelaListRoutes', false) ? routeForSort(sort) : null;

  if (sortRoute && (routeName === 'index' || currentSortRoute())) {
    delete params.sort;
    routeName = sortRoute;
  } else if (currentSortRoute()) {
    routeName = 'index';
    params.sort = sort;
  } else if (sort === app.search.state.defaultSort()) {
    delete params.sort;
  } else {
    params.sort = sort;
  }

  // Parâmetros vazios só sujariam a URL ("?q=&filter=").
  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (value === undefined || value === '' || (typeof value === 'object' && value && !Object.keys(value).length)) delete params[key];
  });

  return app.route(routeName, params);
}

/** Linha de um dropdown da barra: uma tag ou uma opção especial. */
interface DropRow {
  key: string;
  href: string;
  tag?: CanelaTag;
  parent?: CanelaTag;
  label?: string;
  special?: boolean;
  selected?: boolean;
}

/** Quantas etiquetas o dropdown lista: o resto aparece ao filtrar. */
const MAX_TAGS_IN_LIST = 30;

/** Acima disso, "sem tags secundárias" viraria uma consulta com subconsultas demais. */
const MAX_NEGATED_TAGS = 50;

/**
 * URL de uma tag preservando a ordenação escolhida. `filter` entra na query (`filter[-tag][]=…`): o IndexPage o
 * repassa à API, e o servidor também o usa no carregamento inicial.
 */
function tagHref(tag: CanelaTag | null, filter?: Record<string, string[]>): string {
  const sort = onIndex() ? app.search.state.params().sort : undefined;
  const params: Record<string, any> = sort ? { sort } : {};

  if (filter) params.filter = filter;

  return tag ? app.route('tag', { tags: tag.slug(), ...params }) : app.route('index', params);
}

/** As tags negadas na URL atual (`filter[-tag]`), para marcar "nenhuma…"/"sem…". */
function negatedSlugs(): string[] {
  if (!onIndex()) return [];

  const value = (app.search.state.params().filter || ({} as any))['-tag'];
  const list: unknown[] = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : value ? [value] : [];

  return list.flatMap((item) => String(item).split(','));
}

/** O cabeçalho com a categoria escolhida: o badge dela, "Pai ▪ Filha" não — só ela. */
function categoryHeader(tag: CanelaTag, parent: CanelaTag | null = null): Mithril.Children {
  return (
    <span className="CanelaNav-dropBadge">
      {parent && !tag.icon() ? splitSymbol(tag, parent) : categorySymbol(tag)}
      <span className="CanelaNav-dropName">{tag.name()}</span>
    </span>
  );
}

/** O quadradinho em duas cores da subcategoria sem ícone. */
function splitSymbol(tag: CanelaTag, parent: CanelaTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);

  if (symbol?.attrs) {
    symbol.attrs.className = classList(symbol.attrs.className, 'CanelaCategorySymbol--split');
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--cn-primary-medium)' };
  }

  return symbol;
}

/** "ícone Nome × N" (+ a descrição para visitantes), como a `category-row`. */
function dropRowContent(row: DropRow, symbols: boolean, showDescription: boolean): Mithril.Children {
  const tag = row.tag!;
  const count = tag.discussionCount();
  const description = symbols && showDescription ? tag.description() : null;

  return (
    <span className="CanelaNav-dropRow">
      <span className="CanelaNav-dropStatus">
        {symbols ? (row.parent && !tag.icon() ? splitSymbol(tag, row.parent) : categorySymbol(tag)) : tagSymbol(tag, 'CanelaNav-dropTagIcon')}
        <span className="CanelaNav-dropName">{tag.name()}</span>
        {symbols && count > 0 && <span className="CanelaNav-dropCount">× {count}</span>}
      </span>
      {description && <span className="CanelaNav-dropDesc">{description}</span>}
    </span>
  );
}

export default class ListNavigation extends Component<ListNavigationAttrs> {
  view(): Mithril.Children {
    return (
      // Grudar no topo é opção do admin.
      <nav className={classList('CanelaNav', { 'CanelaNav--sticky': forumBool('canelaNavSticky', false) })} aria-label={t('nav.label')}>
        <div className="CanelaNav-start">{this.startItems().toArray()}</div>
        <div className="CanelaNav-end">{this.endItems().toArray()}</div>
      </nav>
    );
  }

  startItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const page = this.attrs.page;

    if (isTagsEnabled() && forumBool('canelaNavDropdowns', true)) {
      items.add('dropdowns', <div className="CanelaNav-dropdowns">{this.dropdownItems().toArray()}</div>, 100);
    }

    const tabs = this.tabs();
    const overflow = this.overflowTabs();

    items.add(
      'tabs',
      <ul className="CanelaNav-tabs">
        {tabs.map((tab) => (
          <li className={classList('CanelaNav-tab', `CanelaNav-tab--${tab.key}`, { active: tab.active })}>
            <Link href={tab.href} force={true} aria-current={tab.active ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
        {overflow.length > 0 && <li className="CanelaNav-tab CanelaNav-tab--more">{this.overflowDropdown(overflow)}</li>}
      </ul>,
      90
    );

    // No celular as abas viram um seletor só ("Recentes ⇅").
    items.add('select', <div className="CanelaNav-select">{this.compactSelect([...tabs, ...overflow])}</div>, 80);

    if (page) {
      // Itens que extensões põem ao lado da ordenação (filtros, por exemplo).
      const view = page.viewItems();
      view.remove('sort');

      if (!view.isEmpty()) items.add('view', <ul className="CanelaNav-view">{listItems(view.toArray())}</ul>, 70);

      const toolbar = page.toolbarItems();
      toolbar.remove('view');
      toolbar.remove('action');

      if (!toolbar.isEmpty()) items.add('toolbar', <div className="CanelaNav-extra">{toolbar.toArray()}</div>, 60);
    }

    return items;
  }

  endItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const page = this.attrs.page;

    if (page) {
      const actions = page.actionItems();

      // A lupa que o core põe aqui no celular repetiria a do cabeçalho.
      actions.remove('search');

      if (!actions.isEmpty()) items.add('actions', <ul className="CanelaNav-actions">{listItems(actions.toArray())}</ul>, 100);
    }

    // "Iniciar Discussão" só aparece a quem está logado.
    if (app.session.user) items.add('newTopic', this.newTopicButton(), 50);

    return items;
  }

  /** As abas na ordem do tema; ordenações de extensões entram depois de "Melhores". */
  tabs(): NavTab[] {
    const sortMap = app.discussions.sortMap();
    const index = onIndex();
    const current = index ? activeSort() : null;
    const keys = Object.keys(sortMap);

    const ordered = ['relevance', 'latest', 'hot', 'newest', 'unread', 'top'].filter(
      (key) => keys.includes(key) && !this.overflowKeys().includes(key)
    );
    const fromExtensions = keys.filter((key) => !CORE_SORTS.includes(key) && !ordered.includes(key) && !this.overflowKeys().includes(key));

    const tabs: NavTab[] = [...ordered, ...fromExtensions].map((key) => ({
      key,
      label: sortLabel(key),
      href: sortHref(key),
      active: current === key,
    }));

    // Dentro de uma categoria a aba "Categorias" não aparece.
    if (isTagsEnabled() && forumBool('canelaNavCategoriesLink', true) && !currentTag()) {
      tabs.push({
        key: 'categories',
        label: t('nav.categories_link'),
        href: categoriesUrl(),
        active: app.current.get('routeName') === categoriesRouteName(),
      });
    }

    return tabs;
  }

  /**
   * Ordenações que vão para o menu "mais". "Novos" é a lista de
   * tópicos não vistos, que só existe para quem está logado; para visitantes
   * o "mais novos" do Flarum fica no menu, e as abas são as de quem
   * não entrou (Recentes, Em alta, Melhores, Categorias).
   */
  overflowKeys(): string[] {
    return app.session.user ? OVERFLOW_SORTS : ['newest', ...OVERFLOW_SORTS];
  }

  overflowTabs(): NavTab[] {
    const sortMap = app.discussions.sortMap();
    const current = onIndex() ? activeSort() : null;

    return this.overflowKeys()
      .filter((key) => key in sortMap)
      .map((key) => ({
        key,
        label: sortLabel(key),
        href: sortHref(key),
        active: current === key,
      }));
  }

  overflowDropdown(tabs: NavTab[]): Mithril.Children {
    const active = tabs.find((tab) => tab.active);

    return (
      <Dropdown
        className={classList('CanelaNav-more', { active: !!active })}
        buttonClassName="Button Button--text CanelaNav-moreButton"
        menuClassName="Dropdown-menu--right"
        label={active ? active.label : <Icon name="fas fa-ellipsis-h" />}
        caretIcon={active ? 'fas fa-caret-down' : ''}
        accessibleToggleLabel={t('nav.more')}
      >
        {tabs.map((tab) => (
          <LinkButton href={tab.href} active={tab.active} icon={tab.active ? 'fas fa-check' : true}>
            {tab.label}
          </LinkButton>
        ))}
      </Dropdown>
    );
  }

  compactSelect(tabs: NavTab[]): Mithril.Children {
    return (
      <SelectDropdown
        buttonClassName="Button Button--text CanelaNav-selectButton"
        caretIcon="fas fa-chevron-expand"
        defaultLabel={t('nav.latest')}
        accessibleToggleLabel={t('nav.sort_label')}
      >
        {tabs.map((tab) => (
          <LinkButton href={tab.href} active={tab.active} icon={tab.active ? 'fas fa-check' : true}>
            {tab.label}
          </LinkButton>
        ))}
      </SelectDropdown>
    );
  }

  dropdownItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const tag = currentTag();

    // Na página de uma categoria filha, o primeiro dropdown mostra a mãe e o
    // segundo, a filha — como "Suporte › Instalação".
    const isCategory = !!tag && (tag.position() !== null || tag.isChild());
    const parent = tag && tag.isChild() ? (tag.parent() as CanelaTag | null) || null : null;
    const category = isCategory ? parent || tag : null;
    const subcategory = isCategory && parent ? tag : null;
    const label = tag && !isCategory ? tag : null;
    const negated = negatedSlugs();

    const categories = primaryTags();

    if (categories.length) {
      const rows: DropRow[] = [];

      if (category) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(null) });

      categories.forEach((item) => rows.push({ key: item.slug(), tag: item, href: tagHref(item), selected: item === category }));

      items.add(
        'categories',
        this.drop({
          className: 'CanelaNav-drop--categories',
          selected: !!category,
          header: category ? categoryHeader(category) : t('nav.categories'),
          label: t('nav.categories'),
          rows,
          symbols: true,
        }),
        100
      );
    }

    const children = category ? sortTags(((category.children() || []) as CanelaTag[]).filter(Boolean)) : [];

    if (category && children.length) {
      // "nenhuma tag filha": a categoria mãe sem nenhuma das filhas, com o
      // filtro negado do flarum/tags (`filter[-tag][]=filha`, um grupo por
      // filha, para valer "nenhuma" e não "não todas").
      const childSlugs = children.map((child) => child.slug());
      const noSub = !subcategory && childSlugs.length > 0 && childSlugs.every((slug) => negated.includes(slug));
      const rows: DropRow[] = [];

      if (subcategory || noSub) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(category) });
      if (!noSub) rows.push({ key: 'none', special: true, label: t('nav.no_subcategory'), href: tagHref(category, { '-tag': childSlugs }) });

      children.forEach((child) =>
        rows.push({ key: child.slug(), tag: child, href: tagHref(child), selected: child === subcategory, parent: category })
      );

      items.add(
        'subcategories',
        this.drop({
          className: 'CanelaNav-drop--subcategories',
          selected: !!subcategory || noSub,
          header: subcategory ? categoryHeader(subcategory, category) : noSub ? t('nav.no_subcategory') : t('nav.subcategories'),
          label: t('nav.subcategories'),
          rows,
          symbols: true,
        }),
        90
      );
    }

    const labels = secondaryTags();

    if (labels.length) {
      // "sem tags secundárias": nenhuma das etiquetas (as categorias ficam de
      // fora). Com etiquetas demais, a consulta ficaria pesada.
      const labelSlugs = labels.map((item) => item.slug());
      const noTagsSupported = labelSlugs.length <= MAX_NEGATED_TAGS;
      const noTags = noTagsSupported && labelSlugs.every((slug) => negated.includes(slug));
      const rows: DropRow[] = [];
      const base = category ? subcategory || category : null;

      if (label || noTags) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(base) });
      if (noTagsSupported && !noTags) rows.push({ key: 'none', special: true, label: t('nav.no_tags'), href: tagHref(base, { '-tag': labelSlugs }) });

      labels.forEach((item) => rows.push({ key: item.slug(), tag: item, href: tagHref(item), selected: item === label }));

      items.add(
        'tags',
        this.drop({
          className: 'CanelaNav-drop--tags',
          selected: !!label || noTags,
          header: label ? (
            <span className="CanelaNav-dropBadge">
              {tagSymbol(label, 'CanelaNav-dropTagIcon')}
              <span className="CanelaNav-dropName">{label.name()}</span>
            </span>
          ) : noTags ? (
            t('nav.no_tags')
          ) : (
            t('nav.tags')
          ),
          label: t('nav.tags'),
          rows,
          symbols: false,
          limit: MAX_TAGS_IN_LIST,
        }),
        80
      );
    }

    return items;
  }

  /**
   * O dropdown de categoria/etiqueta: cabeçalho com "›" que vira
   * "⌄" aberto, corpo com "Pesquisar…" e a lupa, as opções especiais em
   * negrito na cor de destaque e as categorias "ícone Nome × N".
   */
  drop(options: {
    className: string;
    selected: boolean;
    header: Mithril.Children;
    label: string;
    rows: DropRow[];
    symbols: boolean;
    limit?: number;
  }): Mithril.Children {
    const { rows, limit } = options;
    // A descrição das categorias só para visitantes (quem já tem conta não
    // precisa dela).
    const showDescription = !app.session.user;

    const filtered = (filter: string): DropRow[] => {
      const needle = filter.trim().toLowerCase();
      const special = needle ? [] : rows.filter((row) => row.special);
      let normal = rows.filter((row) => !row.special && (!needle || (row.tag?.name() || '').toLowerCase().includes(needle)));

      if (limit && !needle) normal = normal.slice(0, limit);

      return [...special, ...normal];
    };

    return (
      <SelectKit
        className={classList('CanelaNav-drop', options.className, { 'has-selection': options.selected })}
        header={options.header}
        caret="fas fa-angle-right"
        caretOpen="fas fa-angle-down"
        label={options.label}
        filterIcon={true}
        highlightSelected={true}
        placeholder={t('nav.search_placeholder')}
        emptyText={t('nav.no_results')}
        rows={(filter: string) =>
          filtered(filter).map((row) => ({
            key: row.key,
            selected: row.selected,
            title: row.tag?.name() || row.label,
            content: row.special ? <span className="CanelaNav-dropSpecial">{row.label}</span> : dropRowContent(row, options.symbols, showDescription),
          }))
        }
        after={(filter: string) =>
          limit && !filter.trim() && rows.filter((row) => !row.special).length > limit ? (
            <div className="CanelaNav-dropMore">{t('nav.filter_for_more')}</div>
          ) : null
        }
        onselect={(key: string) => {
          const row = rows.find((item) => item.key === key);

          if (row) m.route.set(row.href);
        }}
      />
    );
  }

  newTopicButton(): Mithril.Children {
    const tag = currentTag() as (CanelaTag & { canStartDiscussion?: () => boolean }) | null;
    const canStart = !app.session.user || (tag?.canStartDiscussion ? tag.canStartDiscussion() : !!app.forum.attribute('canStartDiscussion'));
    const label = canStart ? t('nav.new_topic') : (app.translator.trans('core.forum.index.cannot_start_discussion_button', {}, true) as string);

    return (
      <Button
        icon="fas fa-edit"
        className="Button Button--primary CanelaNav-newTopic"
        aria-label={label}
        title={label}
        disabled={!canStart}
        onclick={() =>
          // Reaproveita a ação do core: abre o composer (ou o login) e deixa o
          // flarum/tags preencher a tag atual, que ele pendura nesse método.
          IndexSidebar.prototype.newDiscussionAction.call(IndexSidebar.prototype).catch(() => {})
        }
      >
        {label}
      </Button>
    );
  }
}
