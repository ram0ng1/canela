/*
 * A página de busca (`/search?q=`): abas (Tópicos, Postagens,
 * Etiquetas e categorias, Usuários), campo grande com "Pesquisar", "Filtros
 * avançados", "Ordenar por", "N resultados para X" e os resultados com
 * título, etiquetas e o trecho com as palavras destacadas.
 *
 * O estado mora todo na URL (`q`, `type`, `sort`): cada pesquisa navega para
 * a nova URL, o resolvedor do core recria a página, e voltar no navegador
 * volta à busca anterior. Só o painel de filtros aberto
 * é lembrado fora dela, para não fechar a cada pesquisa.
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Model from 'flarum/common/Model';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { isTagsEnabled, type CanelaTag } from '../../../utils/tags';
import AdvancedFilters from './AdvancedFilters';
import { hasCriteria, highlightPattern, parseQuery, serializeQuery, type SearchQuery } from './query';
import { discussionResult, postResult, resultSkeleton, tagResult, userResult } from './results';
import { fetchPage, postFilters, sortOptions, type SearchTab } from './sources';

// A rota e a URL moram em ./route, fora do chunk desta página.
import { SEARCH_ROUTE, searchPageEnabled, searchUrl } from './route';

/** O painel de filtros aberto sobrevive à recriação da página a cada busca. */
let filtersExpanded = false;

export default class SearchPage extends Page<IPageAttrs> {
  tab: SearchTab = 'topics';
  sort = 'relevance';
  /** O texto do campo, com os gambits. */
  raw = '';
  query!: SearchQuery;

  items: Model[] = [];
  total: number | null = null;
  hasMore = false;
  loading = false;
  searched = false;
  failed = false;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--canelaSearch';

    const type = String(m.route.param('type') || 'topics') as SearchTab;
    this.tab = this.tabs().some(([key]) => key === type) ? type : 'topics';

    this.raw = String(m.route.param('q') || '').trim();
    this.query = parseQuery(this.raw);

    const sorts = sortOptions(this.tab, t).map((option) => option.key);
    const sort = String(m.route.param('sort') || '');
    // Sem texto não há relevância a ordenar: o padrão vira "mais recente".
    this.sort = sorts.includes(sort) ? sort : this.query.text ? 'relevance' : 'latest';

    app.history.push(SEARCH_ROUTE, t('extras.search.title'));

    if (searchPageEnabled() && this.canSearch()) this.load(0);
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);

    app.setTitle(this.raw ? t('extras.search.meta_title_query', { query: this.raw }) : t('extras.search.title'));
    app.setTitleCount(0);

    // Sem consulta, o campo é a única coisa a fazer na página.
    if (!this.raw) this.$('.CanelaSearch-input').trigger('focus');
  }

  view(): Mithril.Children {
    if (!searchPageEnabled()) {
      return (
        <PageStructure className="CanelaSearchPage">
          <p className="CanelaSearch-empty">{app.translator.trans('core.forum.error.not_found_text')}</p>
        </PageStructure>
      );
    }

    return (
      <PageStructure className="CanelaSearchPage">
        <div className="CanelaSearch">
          {this.tabsView()}
          {this.formView()}
          {this.controlsView()}
          {filtersExpanded && this.filtersAvailable() && (
            <AdvancedFilters query={this.query} postsOnly={this.tab === 'posts'} onchange={(query: SearchQuery) => this.updateQuery(query)} />
          )}
          {this.sortView()}
          {this.resultsView()}
        </div>
      </PageStructure>
    );
  }

  // ── Abas ──────────────────────────────────────────────────────────────────

  tabs(): [SearchTab, string][] {
    const tabs: [SearchTab, string][] = [
      ['topics', t('extras.search.tab_topics')],
      ['posts', t('extras.search.tab_posts')],
    ];

    if (isTagsEnabled()) tabs.push(['categories', t('extras.search.tab_categories')]);
    if (app.forum.attribute('canSearchUsers')) tabs.push(['users', t('extras.search.tab_users')]);

    return tabs;
  }

  tabsView(): Mithril.Children {
    return (
      <nav className="CanelaSearch-tabs" aria-label={t('extras.search.tabs_label')}>
        {this.tabs().map(([key, label]) => (
          <button
            type="button"
            className={classList('CanelaSearch-tab', { active: this.tab === key })}
            aria-current={this.tab === key ? 'page' : undefined}
            onclick={() => this.go(this.raw, key, undefined)}
          >
            {label}
          </button>
        ))}
      </nav>
    );
  }

  // ── Campo ─────────────────────────────────────────────────────────────────

  formView(): Mithril.Children {
    return (
      <form
        className="CanelaSearch-form"
        role="search"
        onsubmit={(event: SubmitEvent) => {
          event.preventDefault();
          // Só a ordenação escolhida de propósito acompanha a nova busca: a
          // padrão muda com o texto (relevância com texto, recentes sem).
          this.go(this.raw, this.tab, m.route.param('sort'));
        }}
      >
        <div className="CanelaSearch-field">
          <input
            className="FormControl CanelaSearch-input"
            type="search"
            enterkeyhint="search"
            aria-label={t('extras.search.input_label')}
            placeholder={t('extras.search.input_placeholder')}
            value={this.raw}
            oninput={(event: InputEvent) => {
              this.raw = (event.target as HTMLInputElement).value;
              // Os controles acompanham os gambits digitados à mão.
              this.query = parseQuery(this.raw);
            }}
          />
          {this.raw && (
            <Button
              className="Button Button--icon Button--link CanelaSearch-clear"
              icon="fas fa-times"
              aria-label={t('extras.search.clear')}
              onclick={() => {
                this.raw = '';
                this.query = parseQuery('');
                this.$('.CanelaSearch-input').trigger('focus');
              }}
            />
          )}
        </div>
        <Button type="submit" className="Button Button--primary CanelaSearch-submit" icon="fas fa-search">
          {t('extras.search.submit')}
        </Button>
      </form>
    );
  }

  filtersAvailable(): boolean {
    return this.tab === 'topics' || this.tab === 'posts';
  }

  controlsView(): Mithril.Children {
    if (!this.filtersAvailable()) return null;

    return (
      <div className="CanelaSearch-controls">
        <Button
          className={classList('Button CanelaSearch-advancedToggle', { active: filtersExpanded })}
          aria-expanded={filtersExpanded ? 'true' : 'false'}
          onclick={() => {
            filtersExpanded = !filtersExpanded;
          }}
        >
          {t('extras.search.advanced')}
          <Icon name={filtersExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="CanelaSearch-advancedCaret" />
        </Button>
      </div>
    );
  }

  updateQuery(query: SearchQuery): void {
    this.query = query;
    this.raw = serializeQuery(query);
  }

  // ── Ordenação ─────────────────────────────────────────────────────────────

  sortView(): Mithril.Children {
    const options = sortOptions(this.tab, t);

    if (!options.length) return <hr className="CanelaSearch-divider" />;

    return (
      <div className="CanelaSearch-sortRow">
        <label className="CanelaSearch-sort">
          <span className="CanelaSearch-sortLabel">{t('extras.search.sort_by')}</span>
          <span className="CanelaSearch-selectWrap">
            <select
              className="FormControl CanelaSearch-select"
              value={this.sort}
              onchange={(event: Event) => this.go(this.raw, this.tab, (event.target as HTMLSelectElement).value)}
            >
              {options.map((option) => (
                <option value={option.key}>{option.label}</option>
              ))}
            </select>
            <Icon name="fas fa-chevron-down" className="CanelaSearch-selectCaret" />
          </span>
        </label>
      </div>
    );
  }

  // ── Resultados ────────────────────────────────────────────────────────────

  /** Etiquetas e usuários só se buscam por texto; tópicos e postagens, também por filtros. */
  canSearch(): boolean {
    if (this.tab === 'categories' || this.tab === 'users') return !!this.query.text;

    return hasCriteria(this.query);
  }

  resultsView(): Mithril.Children {
    if (!this.searched && !this.loading) {
      return <p className="CanelaSearch-empty">{this.raw ? t('extras.search.need_more') : t('extras.search.start')}</p>;
    }

    const pattern = highlightPattern(this.query.text);
    const count = this.total ?? this.items.length;
    const firstPage = this.loading && !this.items.length;
    const skeletonTab = this.tab === 'topics' || this.tab === 'posts';

    return (
      <div className="CanelaSearch-results" aria-live="polite" aria-busy={this.loading ? 'true' : 'false'}>
        {this.searched && !this.failed && (
          <h2 className="CanelaSearch-heading">
            {this.items.length === 0
              ? t('extras.search.no_results')
              : t('extras.search.result_count', { count, more: this.total === null && this.hasMore ? '+' : '' })}
            {this.items.length > 0 &&
              this.query.text && [' ', t('extras.search.result_for'), ' ', <mark className="CanelaSearch-term">{this.query.text}</mark>]}
          </h2>
        )}

        {/* Na primeira busca o título ("N resultados para…") ainda não existe:
            o lugar dele fica reservado, e a lista não desce quando ele chega. */}
        {!this.searched && firstPage && skeletonTab && (
          <h2 className="CanelaSearch-heading">
            <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width: '14em' }} />
          </h2>
        )}

        {this.failed && <p className="CanelaSearch-empty">{t('extras.search.failed')}</p>}

        {this.tab === 'posts' && this.searched && postFilters(this.query).ignored && (
          <p className="CanelaSearchFilters-note">
            <Icon name="fas fa-circle-info" />
            {t('extras.search.posts_filters_note')}
          </p>
        )}

        {/* A primeira página de tópicos ou postagens: as linhas do esqueleto
            no lugar do spinner (o "carregar mais" continua com o spinner). */}
        {firstPage && skeletonTab ? (
          <ul className="CanelaSearch-list CanelaSearch-list--loading" aria-busy="true">
            {resultSkeleton()}
          </ul>
        ) : (
          <ul className="CanelaSearch-list">{this.items.map((item) => this.itemView(item, pattern))}</ul>
        )}

        {this.loading && !(firstPage && skeletonTab) && <LoadingIndicator display="block" />}

        {!this.loading && this.hasMore && (
          <div className="CanelaSearch-more">
            <Button className="Button" onclick={() => this.load(this.items.length)}>
              {t('extras.search.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  itemView(item: Model, pattern: RegExp | undefined): Mithril.Children {
    switch (this.tab) {
      case 'topics':
        return discussionResult(item as Discussion, pattern);
      case 'posts':
        return postResult(item as Post, pattern);
      case 'categories':
        return tagResult(item as unknown as CanelaTag, pattern);
      default:
        return userResult(item as User, pattern);
    }
  }

  load(offset: number): void {
    const sort = sortOptions(this.tab, t).find((option) => option.key === this.sort)?.api || '';

    this.loading = true;
    this.failed = false;

    fetchPage(this.tab, this.query, sort, offset)
      .then((page) => {
        this.items = offset ? [...this.items, ...page.items] : page.items;
        this.total = page.total;
        this.hasMore = page.hasMore;
      })
      .catch(() => {
        // O alerta de erro do core já apareceu; aqui só se troca a mensagem
        // da página, para não ficar um "0 resultados" enganoso.
        this.failed = true;
      })
      .finally(() => {
        this.loading = false;
        this.searched = true;
        m.redraw();
      });
  }

  go(raw: string, tab: SearchTab, sort: string | undefined): void {
    const url = searchUrl(raw.trim(), tab, sort);

    // A mesma URL não recria a página (a chave da rota não muda): pesquisar
    // de novo a mesma coisa só recarrega os resultados.
    if (url === app.route(SEARCH_ROUTE, m.route.param())) {
      if (this.canSearch()) this.load(0);
      return;
    }

    m.route.set(url);
  }
}
