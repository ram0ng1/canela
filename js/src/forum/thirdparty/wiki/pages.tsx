/*
 * As telas da linkrobins/wiki no visual do Canela. Chunk próprio: desce antes
 * do primeiro chunk da wiki (ver ./index), e os `override` por nome de módulo
 * entram na fila do `flarum.reg.onLoad` até as telas dela chegarem.
 *
 * - Índice (/wiki): o hero grande das categorias do tema por cima do cartão;
 *   no alto do cartão, a barra da lista (o dropdown "categorias ›", a busca e
 *   "+ Novo artigo" à direita, como "Novo tópico"); os artigos em linhas com
 *   colunas, como a lista de tópicos ("Artigo · autor · Atividade"); na página
 *   inicial agrupada, uma seção por categoria com o badge dela.
 * - Artigo (/wiki/:id): o título do tópico, o artigo como o primeiro post do
 *   Discourse (avatar, nome, data e o lápis das edições; o texto "cooked"; a
 *   barra de ações com "Editar" e o "⋯"), o mapa do tópico (criado,
 *   atualizado, revisões) e o histórico num painel que abre pelo lápis.
 * - Novo/editar: o formulário com o título e a categoria como no composer do
 *   tema, e o composer da wiki com a cara do de tópico ("Novo artigo", a
 *   categoria e o título na barra de cima).
 *
 * Cada override cai no original quando a integração está desligada no admin.
 * Nada aqui muda o que a wiki salva: só o desenho.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from '../../composer/SelectKit';
import ComposerActionTitle from '../../composer/ComposerActionTitle';
import { fullDate, shortAge } from '../../utils/dates';
import { categorySymbol, type CanelaTag } from '../../utils/tags';
import { t } from '../../utils/settings';
import { thirdParty } from '../settings';
import { wikiArticleUrl, wikiAttr, wikiCan, wikiIndexUrl, wt } from './shared';
import { categoryBadge, categoryUrl, ensureCategories, symbolOf, wikiCategories } from './categories';
import { installCommentComposer, openArticleComposer } from './composer';

const INDEX = 'ext:linkrobins/wiki/forum/components/WikiIndexPage';
const SHOW = 'ext:linkrobins/wiki/forum/components/WikiShowPage';

/** A chave "sem categoria" que a wiki usa no filtro e na URL. */
const NO_CATEGORY = 'none';

const on = () => thirdParty.wiki();

const wtr = (key: string, params: Record<string, unknown> = {}) => t(`thirdparty.wiki.${key}`, params);

// ---------------------------------------------------------------------
// Árvore de vnodes: as telas da wiki são reaproveitadas e só remontadas
// ---------------------------------------------------------------------

function classOf(vnode: any): string {
  const attrs = vnode?.attrs;

  return String((attrs && (attrs.className || attrs.class)) || '');
}

function hasClass(vnode: any, className: string): boolean {
  return classOf(vnode).split(/\s+/).includes(className);
}

/** O primeiro vnode (em profundidade) com a classe; não entra em componentes já montados. */
function findByClass(node: any, className: string): any {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByClass(child, className);

      if (found) return found;
    }

    return null;
  }

  if (hasClass(node, className)) return node;

  return findByClass(node.children, className);
}

function addClass(vnode: any, className: string): void {
  if (!vnode?.attrs) return;

  const key = 'class' in vnode.attrs ? 'class' : 'className';

  vnode.attrs[key] = `${vnode.attrs[key] || ''} ${className}`.trim();
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(String(value));

  return isNaN(date.getTime()) ? null : date;
}

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------

/** A categoria filtrada no índice (pelo id ou pelo slug), se houver. */
function indexCategory(page: any): any {
  const current = page.category ? String(page.category) : '';

  if (!current || current === NO_CATEGORY) return null;

  return wikiCategories().find((category) => String(category.id()) === current || category.slug?.() === current) || null;
}

/** O hero do índice: "Wiki", o nome da categoria (com a descrição) ou a busca. */
function indexHero(page: any): Mithril.Children {
  const query = String(page.query || '').trim();

  // O layout próprio do admin traz os títulos dele.
  if (!query && !page.category && page.blocks?.length) return null;

  const category = query ? null : indexCategory(page);
  const uncategorised = !query && page.category === NO_CATEGORY;

  let title: Mithril.Children = wt('nav', 'Wiki');

  if (query) title = wt('search.results_heading', `Results for "${query}"`, { query });
  else if (category) title = category.name();
  else if (uncategorised) title = wt('index.uncategorised', 'Other');

  const home = !query && !category && !uncategorised;
  const description = category ? category.description() || null : home ? wtr('hero_description') : null;

  // Os números da wiki (a soma das categorias): "12 artigos · 3 categorias";
  // numa categoria, só os artigos dela.
  const categories = wikiCategories();
  const articles = category
    ? Number(category.articleCount?.() || 0)
    : categories.reduce((sum, item) => sum + (Number(item.articleCount?.() || 0) || 0), 0);
  const stats: string[] = [];

  if (!query && articles > 0) stats.push(wtr('hero_articles', { count: articles }));
  if (home && categories.length > 0) stats.push(wtr('hero_categories', { count: categories.length }));

  return (
    <header
      className={classList('Hero CanelaCategoryHero CanelaWikiHero', { 'CanelaWikiHero--home': home })}
      style={category?.color() ? { '--category-color': category.color() } : undefined}
    >
      <div className="container">
        <h1 className="CanelaCategoryHero-title">
          {category ? <span className="CanelaCategoryHero-icon">{symbolOf(category)}</span> : null}
          {title}
        </h1>
        {description ? <p className="CanelaCategoryHero-description">{description}</p> : null}
        {stats.length ? <p className="CanelaWikiHero-stats">{stats.join(' · ')}</p> : null}
      </div>
    </header>
  );
}

/** As linhas cinzas que brilham enquanto a lista carrega (o skeleton do tema). */
function listSkeleton(rows = 5): Mithril.Children {
  return (
    <div className="CanelaWikiList CanelaWikiList--loading" aria-busy="true">
      {listHeader()}
      <div className="CanelaWikiList-rows">
        {Array.from({ length: rows }, (_, index) => (
          <div className="CanelaWikiRow CanelaWikiRow--skeleton">
            <div className="CanelaWikiRow-main">
              <span className="CanelaSkeleton CanelaWikiSkeleton-title" style={{ width: `${55 - (index % 3) * 12}%` }} />
              <span className="CanelaSkeleton CanelaWikiSkeleton-line" />
              <span className="CanelaSkeleton CanelaWikiSkeleton-line CanelaWikiSkeleton-line--short" />
            </div>
            <div className="CanelaWikiCell--author">
              <span className="CanelaSkeleton CanelaWikiSkeleton-avatar" />
            </div>
            <div className="CanelaCell CanelaCell--activity">
              <span className="CanelaSkeleton CanelaWikiSkeleton-age" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * O vazio do Discourse (`.empty-state`): o ícone grande, a frase e a ação.
 * Na busca, "limpar a busca"; sem artigos, "Novo artigo" para quem pode.
 */
function emptyState(page: any, error: boolean): Mithril.Children {
  const query = String(page.query || '').trim();
  let icon = 'fas fa-book-open';
  let title = wtr('empty_title');
  let text: string = wikiCan.create() ? wt('index.empty_own', 'No articles yet.') : wt('index.empty', 'No articles to show.');
  let action: Mithril.Children = newArticleButton('Button Button--primary CanelaWikiEmpty-action');

  if (error) {
    icon = 'fas fa-triangle-exclamation';
    title = wt('errors.load_articles', 'Could not load articles.');
    text = wtr('empty_error');
    action = (
      <Button className="Button CanelaWikiEmpty-action" icon="fas fa-arrows-rotate" onclick={() => page._init()}>
        {wtr('retry')}
      </Button>
    );
  } else if (query) {
    icon = 'fas fa-magnifying-glass';
    title = wt('search.empty', `No articles match "${query}".`, { query });
    text = wtr('empty_search');
    action = (
      <Button
        className="Button CanelaWikiEmpty-action"
        icon="fas fa-xmark"
        onclick={() => {
          page.query = '';
          page.queryDraft = '';
          page._init();
        }}
      >
        {wtr('clear_search')}
      </Button>
    );
  } else if (page.category) {
    title = wtr('empty_category');
  }

  return (
    <div className="CanelaWikiEmpty">
      <span className="CanelaWikiEmpty-icon">
        <Icon name={icon} />
      </span>
      <h3 className="CanelaWikiEmpty-title">{title}</h3>
      <p className="CanelaWikiEmpty-text">{text}</p>
      {action}
    </div>
  );
}

/** O "categorias ›" da barra da lista, com as categorias da wiki. */
function categoryDrop(page: any): Mithril.Children {
  const categories = wikiCategories();

  if (!categories.length) return null;

  const current = page.category ? String(page.category) : '';
  const selected = indexCategory(page);
  const uncategorised = current === NO_CATEGORY;

  const rows = (filter: string): SelectKitRow[] => {
    const needle = filter.trim().toLowerCase();
    const list: SelectKitRow[] = [];

    if (!needle && current) {
      list.push({ key: '', content: <span className="CanelaNav-dropSpecial">{wtr('all_categories')}</span> });
    }

    categories
      .filter((category) => !needle || String(category.name()).toLowerCase().includes(needle))
      .forEach((category) => {
        const count = Number(category.articleCount?.() || 0);

        list.push({
          key: String(category.id()),
          selected: category === selected,
          title: category.name(),
          content: (
            <span className="CanelaNav-dropRow">
              <span className="CanelaNav-dropStatus">
                {symbolOf(category)}
                <span className="CanelaNav-dropName">{category.name()}</span>
                {count > 0 && <span className="CanelaNav-dropCount">× {count}</span>}
              </span>
              {category.description() ? <span className="CanelaNav-dropDesc">{category.description()}</span> : null}
            </span>
          ),
        });
      });

    return list;
  };

  return (
    <div className="CanelaNav-dropdowns CanelaWikiNav-dropdowns">
      <SelectKit
        className={classList('CanelaNav-drop CanelaWikiNav-drop', { 'has-selection': !!current })}
        header={
          selected ? (
            <span className="CanelaNav-dropBadge">
              {symbolOf(selected)}
              <span className="CanelaNav-dropName">{selected.name()}</span>
            </span>
          ) : uncategorised ? (
            wt('index.uncategorised', 'Other')
          ) : (
            wtr('categories')
          )
        }
        caret="fas fa-angle-right"
        caretOpen="fas fa-angle-down"
        label={wtr('categories')}
        filterIcon={true}
        highlightSelected={true}
        placeholder={t('nav.search_placeholder')}
        emptyText={t('nav.no_results')}
        rows={rows}
        onselect={(key: string) => m.route.set(key ? categoryUrl(key) : wikiIndexUrl())}
      />
    </div>
  );
}

/** A busca da wiki, com a mesma espera de 300 ms da original. */
function searchBox(page: any): Mithril.Children {
  const placeholder = wt('search.placeholder', 'Search the wiki');

  return (
    <div className="CanelaWikiNav-search" role="search">
      <Icon name="fas fa-magnifying-glass" className="CanelaWikiNav-searchIcon" />
      <input
        className="FormControl CanelaWikiNav-searchInput"
        type="search"
        value={page.queryDraft}
        placeholder={placeholder}
        aria-label={placeholder}
        oninput={(e: InputEvent) => {
          page.queryDraft = (e.target as HTMLInputElement).value;
          clearTimeout(page._searchTimer);
          page._searchTimer = setTimeout(() => {
            const next = String(page.queryDraft || '').trim();

            if (next === page.query) return;

            page.query = next;
            page._init();
          }, 300);
        }}
      />
    </div>
  );
}

/** "+ Novo artigo": o "Novo tópico" da barra da lista (só ícone no celular). */
function newArticleButton(className = 'Button Button--primary CanelaNav-newTopic CanelaWikiNav-new'): Mithril.Children {
  if (!wikiCan.create()) return null;

  const label = wt('index.new_article', 'New article');

  return (
    <Button
      icon="fas fa-plus"
      className={className}
      aria-label={label}
      title={wt('index.new_article_tooltip', label)}
      onclick={() => openArticleComposer()}
    >
      {label}
    </Button>
  );
}

function listHeader(): Mithril.Children {
  return (
    <div className="CanelaListHeader CanelaWikiList-header" role="presentation">
      <span className="CanelaListHeader-cell CanelaListHeader-cell--topic">{wtr('column_article')}</span>
      <span className="CanelaListHeader-cell CanelaWikiCell--author" />
      <span className="CanelaListHeader-cell CanelaCell--activity">{t('list.activity')}</span>
    </div>
  );
}

/** Uma linha da lista: título, badges, resumo, o avatar do autor e a idade. */
function articleRow(article: any, hideCategory: boolean): Mithril.Children {
  const href = wikiArticleUrl(article);
  const category = safe(() => article.category?.(), null);
  const author = safe(() => article.user?.(), null);
  const isDraft = !!safe(() => article.isDraft?.(), false);
  const isDeleted = !!safe(() => article.isDeleted?.(), false);
  const excerpt = String(safe(() => article.excerpt?.(), '') || '');
  const date = toDate(safe(() => article.lastEditedAt?.() || article.createdAt?.(), null));

  return (
    <div
      key={`article-${article.id()}`}
      className={classList('CanelaWikiRow', { 'CanelaWikiRow--draft': isDraft, 'CanelaWikiRow--deleted': isDeleted })}
    >
      <div className="CanelaWikiRow-main">
        <h3 className="CanelaWikiRow-titleLine">
          {isDraft || isDeleted ? (
            <span className="CanelaWikiRow-status">
              {isDraft && <Icon name="fas fa-file-pen" />}
              {isDeleted && <Icon name="fas fa-trash" />}
            </span>
          ) : null}
          <Link href={href} className="CanelaWikiRow-title">
            {article.title() || wt('index.untitled', 'Untitled')}
          </Link>
        </h3>
        <div className="CanelaWikiRow-meta">
          {category && !hideCategory ? categoryBadge(category) : null}
          {isDraft && <span className="CanelaWikiTag">{wt('index.draft_badge', 'Draft')}</span>}
          {isDeleted && <span className="CanelaWikiTag CanelaWikiTag--danger">{wt('index.deleted_badge', 'Deleted')}</span>}
        </div>
        {excerpt ? <div className="CanelaWikiRow-excerpt">{excerpt}</div> : null}
      </div>
      <div className="CanelaWikiCell--author">
        {author ? (
          <Link href={app.route.user(author)} className="CanelaPosters-avatar" aria-label={author.displayName()} title={author.displayName()}>
            <Avatar user={author} />
          </Link>
        ) : null}
      </div>
      <div className="CanelaCell CanelaCell--activity" title={date ? fullDate(date) : undefined}>
        <Link href={href} className="CanelaActivity">
          {shortAge(date)}
        </Link>
      </div>
    </div>
  );
}

function installIndex(): void {
  extend(INDEX as any, 'oninit', function () {
    if (on() && wikiAttr('linkrobinsWikiFullWidth')) ensureCategories();
  });

  extend(INDEX as any, 'view', function (this: any, vnode: any) {
    if (!on() || !vnode?.attrs) return;

    addClass(vnode, 'CanelaWiki CanelaWiki--index');
    vnode.attrs.hero = () => indexHero(this);
  });

  override(INDEX as any, '_renderHeader', function (this: any, original: () => Mithril.Children) {
    if (!on()) return original();

    return (
      <nav className="CanelaNav CanelaWikiNav" aria-label={wt('nav', 'Wiki')}>
        <div className="CanelaNav-start">
          {categoryDrop(this)}
          {this._renderSearch()}
        </div>
        <div className="CanelaNav-end">{newArticleButton()}</div>
      </nav>
    );
  });

  override(INDEX as any, '_renderSearch', function (this: any, original: () => Mithril.Children) {
    return on() ? searchBox(this) : original();
  });

  // A wiki só põe o botão no cabeçalho em largura total (com a coluna, ele
  // mora nela); aqui ele é o "Novo tópico" da barra, sempre.
  override(INDEX as any, '_renderNewArticleButton', function (this: any, original: () => Mithril.Children) {
    return on() ? newArticleButton() : original();
  });

  override(INDEX as any, '_renderList', function (this: any, original: (...args: any[]) => Mithril.Children, articles: any, opts: any = {}) {
    if (!on()) return original(articles, opts);
    if (this.loading) return listSkeleton(opts.canelaGrouped ? 3 : 6);
    if (this.error || !articles || !articles.length) return emptyState(this, !!this.error);

    const hideCategory = !!opts.hideCategory;

    return (
      <div className={classList('CanelaWikiList', { 'CanelaWikiList--grouped': !!opts.canelaGrouped })}>
        {opts.canelaGrouped ? null : listHeader()}
        <div className="CanelaWikiList-rows">{articles.map((article: any) => articleRow(article, hideCategory))}</div>
      </div>
    );
  });

  // A página inicial agrupada: uma seção por categoria, com o badge grande,
  // a descrição e o "Ver todos" no lugar do cartão tracejado da wiki.
  override(INDEX as any, '_renderGrouped', function (this: any, original: (groups: any) => Mithril.Children, groups: any) {
    if (!on()) return original(groups);

    // Seções com key num contêiner próprio: o cabeçalho das colunas, sem key,
    // não pode dividir a mesma lista com elas.
    const sections = groups.map((group: any) => {
      const category = group.cat;
      const name = category ? category.name() : wt('index.uncategorised', 'Other');
      const href = categoryUrl(String(group.key));

      return (
        <section
          key={`group-${group.key}`}
          className="CanelaWikiGroup"
          style={category?.color() ? { '--category-color': category.color() } : undefined}
        >
          <header className="CanelaWikiGroup-header">
            <h2 className="CanelaWikiGroup-title">
              <Link href={href} className="CanelaCategoryBadge">
                {category ? symbolOf(category) : <span className="CanelaCategorySymbol CanelaCategorySymbol--square" aria-hidden="true" />}
                <span className="CanelaCategoryBadge-name">{name}</span>
              </Link>
            </h2>
            {group.more ? (
              <Link href={href} className="CanelaWikiGroup-more">
                {wtr('see_all')}
                <Icon name="fas fa-angle-right" />
              </Link>
            ) : null}
            {category?.description() ? <p className="CanelaWikiGroup-description">{category.description()}</p> : null}
          </header>
          {this._renderList(group.items, { hideCategory: true, canelaGrouped: true })}
        </section>
      );
    });

    return [listHeader(), <div className="CanelaWikiGroups">{sections}</div>];
  });
}

// ---------------------------------------------------------------------
// Artigo
// ---------------------------------------------------------------------

function userAvatar(user: any, className = ''): Mithril.Children {
  if (!user) return null;

  return (
    <Link href={app.route.user(user)} className={className} title={user.displayName()} aria-label={user.displayName()}>
      <Avatar user={user} />
    </Link>
  );
}

function openHistory(page: any, article: any): void {
  const opening = !page.historyOpen;

  page._toggleHistory(article);

  if (opening) {
    setTimeout(() => document.querySelector('.CanelaWikiHistory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

function copyLink(article: any): void {
  const url = window.location.origin + wikiArticleUrl(article);
  const nav: any = navigator;

  if (typeof nav.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches) {
    nav.share({ title: article.title(), url }).catch(() => {});
    return;
  }

  const done = () => app.alerts.show({ type: 'success' }, t('topic.link_copied'));

  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('', url));
  else window.prompt('', url);
}

/** O cabeçalho do post: avatar, nome, "editado por", o lápis das edições e a data. */
function postHeader(page: any, article: any): Mithril.Children {
  const author = safe(() => article.user?.(), null);
  const editor = safe(() => article.lastEditedBy?.(), null);
  const created = toDate(safe(() => article.createdAt?.(), null));
  const edited = toDate(safe(() => article.lastEditedAt?.(), null));
  const revisions = Number(safe(() => article.revisionCount?.(), 0)) || 0;
  const edits = Math.max(0, revisions - 1);
  const editorName = editor ? editor.displayName() : '';

  return (
    <div className="CanelaWikiPost-header">
      <div className="CanelaWikiPost-avatar">{userAvatar(author)}</div>
      <div className="CanelaWikiPost-names">
        {author ? (
          <Link href={app.route.user(author)} className="CanelaWikiPost-username">
            {username(author)}
          </Link>
        ) : null}
        {editor && editor !== author ? <span className="CanelaWikiPost-editor">{wtr('edited_by', { name: editorName })}</span> : null}
      </div>
      <div className="CanelaWikiPost-info">
        {edits > 0 && wikiCan.history() ? (
          <button
            type="button"
            className={classList('Button--ua-reset CanelaWikiPost-edits', { active: page.historyOpen })}
            title={edited ? wtr('edits_title', { date: fullDate(edited) }) : undefined}
            aria-label={wtr('history_title')}
            aria-expanded={page.historyOpen ? 'true' : 'false'}
            onclick={() => openHistory(page, article)}
          >
            <span className="CanelaWikiPost-editsCount">{edits}</span>
            <Icon name="fas fa-pencil" />
          </button>
        ) : null}
        <span className="CanelaWikiPost-date" title={created ? fullDate(created) : undefined}>
          {shortAge(created)}
        </span>
      </div>
    </div>
  );
}

/** A barra de ações do post: copiar link, "Editar" (com o rótulo, como nos posts wiki) e o "⋯". */
function postActions(page: any, article: any, menu: Mithril.Children[]): Mithril.Children {
  const canUpdate = !!safe(() => article.canUpdate?.(), false);
  const editLabel = wt('action.edit', 'Edit');

  return (
    <nav className="CanelaWikiPost-actions">
      <Button
        className="Button Button--icon Button--flat CanelaWikiPost-action"
        icon="fas fa-link"
        title={wtr('share')}
        aria-label={wtr('share')}
        onclick={() => copyLink(article)}
      />
      {menu.length ? (
        <Dropdown
          className="CanelaWikiPost-more"
          buttonClassName="Button Button--icon Button--flat CanelaWikiPost-action"
          menuClassName="Dropdown-menu--right"
          icon="fas fa-ellipsis"
          caretIcon={null}
          label=""
          accessibleToggleLabel={wtr('more')}
        >
          {menu}
        </Dropdown>
      ) : null}
      {canUpdate ? (
        <Button
          className="Button Button--flat CanelaWikiPost-action CanelaWikiPost-edit"
          icon="fas fa-pencil"
          onclick={() => openArticleComposer(article)}
        >
          {editLabel}
        </Button>
      ) : null}
    </nav>
  );
}

/** O mapa do tópico: "criado" e "atualizado" com avatar e idade, e as revisões. */
function articleMap(page: any, article: any): Mithril.Children {
  const author = safe(() => article.user?.(), null);
  const editor = safe(() => article.lastEditedBy?.(), null);
  const created = toDate(safe(() => article.createdAt?.(), null));
  const edited = toDate(safe(() => article.lastEditedAt?.(), null));
  const revisions = Number(safe(() => article.revisionCount?.(), 0)) || 0;

  // As mesmas peças do mapa do tópico (topic/components/TopicMap): o número
  // na cor do link sobre o rótulo, e os avatares de quem escreveu à direita.
  const when = (key: string, label: string, date: Date | null) => (
    <div className={`CanelaTopicMap-stat CanelaTopicMap-stat--${key}`} title={date ? fullDate(date) : undefined}>
      <span className="CanelaTopicMap-number number">{shortAge(date)}</span>
      <span className="CanelaTopicMap-label">{label}</span>
    </div>
  );
  const people = [author, editor].filter((user, index, list) => user && list.indexOf(user) === index);

  return (
    <section className="CanelaTopicMap CanelaTopicMap--op CanelaWikiMap">
      <div className="CanelaTopicMap-stats">
        {when('created', wtr('created'), created)}
        {edited && (!created || edited.getTime() - created.getTime() > 60000) ? when('updated', wtr('updated'), edited) : null}
        {revisions > 0 && wikiCan.history() ? (
          <button
            type="button"
            className={classList('CanelaTopicMap-stat CanelaTopicMap-stat--revisions', { active: page.historyOpen })}
            aria-expanded={page.historyOpen ? 'true' : 'false'}
            onclick={() => openHistory(page, article)}
          >
            <span className="CanelaTopicMap-number number">{revisions}</span>
            <span className="CanelaTopicMap-label">{wtr('revisions', { count: revisions })}</span>
          </button>
        ) : null}
        {people.length ? (
          <div className="CanelaTopicMap-users">
            {people.map((user: any) => (
              <Link className="CanelaTopicMap-poster" href={app.route.user(user)} title={user.displayName()}>
                <Avatar user={user} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** O título como o do tópico, com "Wiki ›" e a categoria logo abaixo. */
function articleTitle(article: any): Mithril.Children {
  const category = safe(() => article.category?.(), null);
  const isDraft = !!safe(() => article.isDraft?.(), false);
  const isDeleted = !!safe(() => article.isDeleted?.(), false);

  return (
    <header className="CanelaWikiArticle-header">
      <h1 className="CanelaWikiArticle-title">
        {isDraft ? <Icon name="fas fa-file-pen" className="CanelaWikiArticle-status" /> : null}
        {isDeleted ? <Icon name="fas fa-trash" className="CanelaWikiArticle-status" /> : null}
        {article.title()}
      </h1>
      <div className="CanelaWikiArticle-crumbs">
        <Link href={wikiIndexUrl()} className="CanelaWikiArticle-crumb">
          <Icon name="fas fa-book-open" />
          {wt('nav', 'Wiki')}
        </Link>
        {category ? <Icon name="fas fa-angle-right" className="CanelaWikiArticle-crumbSep" /> : null}
        {category ? categoryBadge(category) : null}
      </div>
    </header>
  );
}

/** O artigo carregando: título, avatar e linhas que brilham. */
function articleSkeleton(): Mithril.Children {
  return (
    <div className="CanelaWikiArticle-skeleton" aria-busy="true">
      <span className="CanelaSkeleton CanelaWikiSkeleton-heading" />
      <span className="CanelaSkeleton CanelaWikiSkeleton-crumb" />
      <div className="CanelaWikiPost CanelaWikiPost--skeleton">
        <span className="CanelaSkeleton CanelaWikiSkeleton-postAvatar" />
        {[92, 100, 84, 96, 60, 100, 88, 40].map((width) => (
          <span className="CanelaSkeleton CanelaWikiSkeleton-line" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Artigo que não abre (excluído, sem permissão): o vazio do tema com "voltar à wiki". */
function articleError(): Mithril.Children {
  return (
    <div className="CanelaWikiEmpty">
      <span className="CanelaWikiEmpty-icon">
        <Icon name="fas fa-file-circle-question" />
      </span>
      <h3 className="CanelaWikiEmpty-title">{wtr('not_found')}</h3>
      <p className="CanelaWikiEmpty-text">{wt('errors.load_article', 'Could not load this article.')}</p>
      <Button className="Button Button--primary CanelaWikiEmpty-action" icon="fas fa-book-open" onclick={() => m.route.set(wikiIndexUrl())}>
        {wtr('back_to_wiki')}
      </Button>
    </div>
  );
}

/**
 * "‹ Anterior · Próximo ›" dentro da categoria, na ordem da wiki (posição e
 * depois a edição mais recente): a lista vem de canelaSiblings (ver o
 * override de _loadRelated).
 */
function articlePager(page: any, article: any): Mithril.Children {
  const siblings: any[] = page.canelaSiblings || [];
  const index = siblings.findIndex((item) => String(item.id()) === String(article.id()));

  if (index < 0 || siblings.length < 2) return null;

  const prev = siblings[index - 1];
  const next = siblings[index + 1];

  const card = (item: any, direction: 'prev' | 'next') =>
    item ? (
      <Link href={wikiArticleUrl(item)} className={`CanelaWikiPager-link CanelaWikiPager-link--${direction}`}>
        <span className="CanelaWikiPager-label">
          {direction === 'prev' ? <Icon name="fas fa-arrow-left" /> : null}
          {wtr(direction === 'prev' ? 'previous' : 'next')}
          {direction === 'next' ? <Icon name="fas fa-arrow-right" /> : null}
        </span>
        <span className="CanelaWikiPager-title">{item.title()}</span>
      </Link>
    ) : (
      <span className={`CanelaWikiPager-link CanelaWikiPager-link--${direction} CanelaWikiPager-link--empty`} />
    );

  return (
    <nav className="CanelaWikiPager" aria-label={wtr('pager_label')}>
      {card(prev, 'prev')}
      {card(next, 'next')}
    </nav>
  );
}

/** Põe a navegação logo antes dos relacionados (ou dos comentários). */
function withPager(rest: any[], pager: Mithril.Children): any[] {
  if (!pager) return rest;

  const at = rest.findIndex((child) => hasClass(child, 'LinkRobinsWiki-related') || (child && typeof child.tag !== 'string'));

  if (at < 0) return [...rest, pager];

  return [...rest.slice(0, at), pager, ...rest.slice(at)];
}

const COMMENTS = 'ext:linkrobins/wiki/forum/components/WikiComments';

/**
 * Comentar como responder um tópico: um botão "Responder" que abre o
 * composer do Flarum embaixo da tela, e nada de caixa de texto na página.
 * Sem o composer (instalação enxuta), a caixa da wiki só aparece depois do
 * clique.
 */
function installComments(): void {
  override(COMMENTS as any, '_renderForm', function (this: any, original: () => Mithril.Children) {
    const form = original();

    if (!on() || !form) return form;

    const docked = !!(findByClass(form, 'ReplyPlaceholder') || findByClass(form, 'CommentPost'));

    if (!docked && this.canelaFormOpen) return form;

    const label = app.translator.trans('core.forum.discussion_controls.reply_button', {}, true) as string;

    return (
      <div className="CanelaWikiComments-reply">
        <Button
          className="Button Button--primary CanelaTopicFooter-reply CanelaWikiComments-replyButton"
          icon="fas fa-reply"
          onclick={() => {
            if (docked) this._openComposer();
            else this.canelaFormOpen = true;
          }}
        >
          {label}
        </Button>
      </div>
    );
  });
}

function installShow(): void {
  installComments();

  // Os irmãos da categoria (até 50) num pedido só: dão os relacionados da
  // wiki e o "anterior/próximo" do tema.
  override(SHOW as any, '_loadRelated', function (this: any, original: (article: any) => void, article: any) {
    this.canelaSiblings = [];

    if (!on()) return original(article);

    this.related = [];

    const category = safe(() => article.category?.(), null);

    if (!category) return;

    const relatedOn = wikiAttr('linkrobinsWikiRelatedEnabled');
    const limit = Math.min(20, Math.max(1, parseInt(String(wikiAttr('linkrobinsWikiRelatedLimit') ?? 5), 10) || 5));

    app.store
      .find(
        'linkrobins-wiki-articles' as any,
        {
          filter: { categoryId: category.id() },
          sort: 'position,-lastEditedAt',
          page: { limit: 50 },
          include: 'user,category',
        } as any
      )
      .then((list: any) => {
        const items = (Array.isArray(list) ? list : []) as any[];

        this.canelaSiblings = items;
        this.related =
          relatedOn === null || relatedOn === undefined || relatedOn
            ? items.filter((item) => String(item.id()) !== String(article.id())).slice(0, limit)
            : [];
        m.redraw();
      })
      .catch(() => {});
  });

  extend(SHOW as any, 'view', function (this: any, vnode: any) {
    if (!on() || !vnode?.attrs) return;

    addClass(vnode, 'CanelaWiki CanelaWiki--show');
  });

  override(SHOW as any, '_renderContent', function (this: any, original: () => any) {
    if (on() && this.loading) return articleSkeleton();
    if (on() && (this.error || !this.article)) return articleError();

    const tree = original();

    if (!on() || this.loading || this.error || !this.article) return tree;

    const article = this.article;
    const layout = findByClass(tree, 'LinkRobinsWiki-articleLayout');
    const main = findByClass(layout, 'LinkRobinsWiki-articleMain');
    const header = findByClass(main, 'LinkRobinsWiki-articleHeader');
    const body = findByClass(main, 'LinkRobinsWiki-articleBody');

    if (!layout || !main || !body || !Array.isArray(main.children)) return tree;

    // Os itens do "⋯" da wiki (denunciar, excluir, restaurar…), sem o
    // "Editar", que vira o botão com rótulo da barra.
    const dropdown = findByClass(header, 'LinkRobinsWiki-articleControls')?.children?.[0];
    const menu = (Array.isArray(dropdown?.children) ? dropdown.children : []).filter(
      (item: any) => item && !/pencil/.test(String(item.attrs?.icon || ''))
    );

    addClass(body, 'CanelaWikiPost-body');

    const history = main.children.find((child: any) => hasClass(child, 'LinkRobinsWiki-history'));
    const rest = main.children.filter((child: any) => child && child !== header && child !== body && child !== history);
    const mobileToc = Array.isArray(tree) ? tree.find((child: any) => hasClass(child, 'LinkRobinsWiki-mobileToc')) : null;
    const notices = Array.isArray(tree)
      ? tree.filter((child: any) => hasClass(child, 'LinkRobinsWiki-deletedNotice') || hasClass(child, 'LinkRobinsWiki-draftNotice'))
      : [];

    main.children = [
      mobileToc || null,
      <article className="CanelaWikiPost">
        {postHeader(this, article)}
        {body}
        {postActions(this, article, menu)}
      </article>,
      articleMap(this, article),
      history || null,
      ...withPager(rest, articlePager(this, article)),
    ];

    addClass(layout, 'CanelaWikiArticle-layout');

    return [articleTitle(article), ...notices, layout];
  });

  // O histórico abre pelo lápis do post ou pelas revisões do mapa; aberto, é
  // um painel com título e "fechar", e não o botão "Histórico (n)" da wiki.
  override(SHOW as any, '_renderHistory', function (this: any, original: (article: any) => Mithril.Children, article: any) {
    const panel = original(article);

    if (!on() || !panel) return panel;
    if (!this.historyOpen) return null;

    return (
      <section className="LinkRobinsWiki-history CanelaWikiHistory">
        <header className="CanelaWikiHistory-header">
          <h2 className="CanelaWikiHistory-title">
            <Icon name="fas fa-clock-rotate-left" />
            {wtr('history_title')}
          </h2>
          <Button
            className="Button Button--icon Button--flat"
            icon="fas fa-xmark"
            title={wtr('close')}
            aria-label={wtr('close')}
            onclick={() => this._toggleHistory(article)}
          />
        </header>
        {this._renderRevisions(article)}
      </section>
    );
  });

  // Uma revisão: seta, avatar, nome, data e o resumo; aberta, o diff da wiki.
  override(SHOW as any, '_renderRevision', function (this: any, original: (rev: any, idx: any) => Mithril.Children, rev: any, idx: any) {
    if (!on()) return original(rev, idx);

    const user = safe(() => rev.user?.(), null);
    const id = String(rev.id());
    const expanded = this.expandedRevision === id;
    const prev = this.revisions ? this.revisions[idx + 1] : null;
    const date = toDate(safe(() => rev.createdAt?.(), null));
    const summary = safe(() => rev.summary?.(), '');

    return (
      <li key={`rev-${id}`} className={classList('LinkRobinsWiki-revision CanelaWikiRevision', { expanded })}>
        <button
          type="button"
          className="Button--ua-reset CanelaWikiRevision-head"
          aria-expanded={expanded ? 'true' : 'false'}
          onclick={() => {
            this.expandedRevision = expanded ? null : id;
          }}
        >
          <Icon name={expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right'} className="CanelaWikiRevision-caret" />
          {user ? <Avatar user={user} className="CanelaWikiRevision-avatar" /> : null}
          <span className="CanelaWikiRevision-user">{user ? user.displayName() : ''}</span>
          {!prev ? <span className="CanelaWikiTag">{wt('show.initial_version', 'created')}</span> : null}
          {summary ? <span className="CanelaWikiRevision-summary">{summary}</span> : null}
          <span className="CanelaWikiRevision-date" title={date ? fullDate(date) : undefined}>
            {shortAge(date)}
          </span>
        </button>
        {expanded ? this._renderDiff(rev, prev) : null}
      </li>
    );
  });
}

let installed = false;

/** Os composers da wiki não trocam de tipo: a ação fica parada, sem a seta. */
function installActionTitle(): void {
  extend(ComposerActionTitle.prototype, 'actionItems', function (this: any, items: any) {
    if (!String(this.attrs?.kind || '').startsWith('wiki')) return;

    Object.keys(items.toObject()).forEach((key) => items.remove(key));
  });
}

/**
 * /wiki/new e /wiki/:id/edit desenham o índice ou o artigo (ver ./index), e
 * o composer abre por cima assim que a tela monta.
 */
export function requestComposer(article: string | null): void {
  setTimeout(() => openArticleComposer(article).catch(() => {}), 0);
}

export default function installWikiPages(): void {
  if (installed) return;
  installed = true;

  installIndex();
  installShow();
  installCommentComposer();
  installActionTitle();
}
