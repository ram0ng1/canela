/*
 * O painel aberto do menu de busca (`search-menu/results.gjs`), num chunk: o
 * campo (SearchMenu) é desenhado desde a primeira pintura e isto desce no
 * ocioso do boot, no hover/foco do campo ou, no máximo, quando o painel abre.
 * Cada abertura cria o painel de novo: a dica aleatória muda, como no Discourse.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import highlight from 'flarum/common/helpers/highlight';
import classList from 'flarum/common/utils/classList';
import escapeRegExp from 'flarum/common/utils/escapeRegExp';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { categoryBadge, currentTag, discussionBadges, tagSymbol, tagUrl, type CanelaTag } from '../utils/tags';
import { shortAge } from '../utils/dates';
import { askAi } from '../features/ai/bot/routes';
import state from './state';
import { fullSearchUrl, MODIFIER_REGEXP } from './query';
import { clearRecentSearches, randomTip, recentSearches, suggestionShortcuts, type QuickTip } from './assist';
import { isCategory } from './engine';
import { aiAvailable, type default as SearchMenu } from './SearchMenu';

export { trigger } from './engine';

interface AssistantItemOpts {
  typeClass?: string;
  icon?: string;
  slug?: string;
  keyword?: string;
  concatSlug?: boolean;
  label?: Mithril.Children;
  suffix?: string;
  extraHint?: boolean;
  withInLabel?: boolean;
  category?: CanelaTag;
  tag?: CanelaTag;
  user?: User;
  searchAllTopics?: boolean;
}

function isPhone(): boolean {
  return app.screen() === 'phone';
}

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Uma URL interna sem recarregar a página; com Ctrl/⌘ ou o botão do meio, o navegador decide. */
function wantsNewWindow(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0;
}

export interface SearchPanelAttrs extends ComponentAttrs {
  menu: SearchMenu;
}

export default class SearchPanel extends Component<SearchPanelAttrs> {
  protected tip: QuickTip | null = null;

  oninit(vnode: Mithril.Vnode<SearchPanelAttrs, this>) {
    super.oninit(vnode);

    this.tip = randomTip();
  }

  view(): Mithril.Children {
    return (
      <div className="menu-panel drop-down search-menu-panel">
        <div className="panel-body">
          <div className="panel-body-contents">{this.resultsView()}</div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Resultados (`search-menu/results.gjs`)
  // ---------------------------------------------------------------------

  resultsView(): Mithril.Children {
    const term = state.term.trim();
    const results = state.results;
    let body: Mithril.Children;

    if (state.suggestionKeyword) {
      body = this.assistant();
    } else if (state.searchTopics && state.invalidTerm) {
      body = <div className="no-results">{t('search_menu.too_short')}</div>;
    } else if (state.searchTopics && state.noResults) {
      body = <div className="no-results">{t('search_menu.no_results')}</div>;
    } else if (!term) {
      body = this.initialOptions();
    } else if (state.searchTopics) {
      body = results && results.topics.length ? [this.topicResults(results.topics, results.text), this.moreLink(results.moreTopics)] : null;
    } else {
      body = [this.initialOptions(), results ? this.quickResults() : null];
    }

    return (
      <div className="results">
        {term && aiAvailable() ? this.askAi(term) : null}
        {body}
      </div>
    );
  }

  /** "Perguntar à IA: termo" (o plugin discourse-ai), no topo do painel. */
  askAi(term: string): Mithril.Children {
    return (
      <ul className="search-menu-assistant CanelaSearchMenu-ai">
        <li className="search-menu-assistant-item ai-ask">
          <a
            href="#"
            className="search-link ai-ask"
            onclick={(event: MouseEvent) => {
              event.preventDefault();
              this.attrs.menu.close();
              askAi(term);
            }}
          >
            <span className="search-icon-wrapper">
              <Icon name="fas fa-wand-magic-sparkles" />
            </span>
            <span className="search-item-wrapper">
              <span className="label-suffix">{t('ai.search.ask_prefix')}</span> <span className="search-item-slug">{term}</span>
            </span>
            <span className="CanelaSearchMenu-aiBadge">{t('ai.search.badge')}</span>
          </a>
        </li>
      </ul>
    );
  }

  /** O texto antes da palavra-chave da sugestão (`AssistantItem.prefix`). */
  itemPrefix(keyword?: string): string {
    const term = state.term || '';
    const lastIndex = keyword ? term.lastIndexOf(keyword) : -1;
    let prefix = '';

    if (lastIndex > 0) prefix = term.substring(0, lastIndex).trim();
    else if (lastIndex < 0) prefix = term.trim();

    return prefix ? `${prefix} ` : '';
  }

  assistantItem(opts: AssistantItemOpts): Mithril.Children {
    const prefix = this.itemPrefix(opts.keyword);
    const hint = isPhone() ? t('search_menu.mobile_enter_hint') : t('search_menu.enter_hint');

    const select = () => {
      const updated = opts.slug && (opts.keyword || opts.concatSlug) ? prefix + opts.slug : prefix.trim();

      // "criado:" pede um valor: o termo recebe a chave e o foco volta ao campo.
      if (opts.slug && /:$/.test(opts.slug)) state.setTerm(updated);
      else state.setTerm(updated, { searchTopics: true });

      this.attrs.menu.input()?.focus();
    };

    let subject: Mithril.Children = null;

    if (opts.category) {
      subject = categoryBadge(opts.category, false);
    } else if (opts.tag) {
      subject = (
        <span className="search-item-tag">
          {tagSymbol(opts.tag, '', 'fas fa-tag')}
          <span className="discourse-tag">{opts.tag.name()}</span>
        </span>
      );
    } else if (opts.user) {
      subject = <span className="search-item-user">{this.userView(opts.user, false)}</span>;
    }

    return (
      <li className={classList(opts.typeClass, 'search-menu-assistant-item')}>
        <a
          href="#"
          className={classList(opts.typeClass, 'search-link')}
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            select();
          }}
        >
          <span className="search-icon-wrapper" aria-label={t('search_menu.title')}>
            <Icon name={opts.icon || 'fas fa-search'} />
          </span>{' '}
          <span className="search-item-wrapper">
            {prefix ? <span className="search-item-prefix">{prefix}</span> : null}
            {opts.withInLabel ? [<span className="label-suffix">{t('search_menu.in')}</span>, ' '] : null}
            {subject}
            {opts.label || opts.suffix ? (
              <span className="search-item-slug">
                {opts.suffix ? <span className="label-suffix">{opts.suffix}</span> : null}
                {opts.label}
              </span>
            ) : null}
            {opts.extraHint ? [' ', <span className="extra-hint">{hint}</span>] : null}
          </span>
        </a>
      </li>
    );
  }

  /** `search-menu/results/assistant.gjs`: categorias e etiquetas, usuários ou atalhos. */
  assistant(): Mithril.Children {
    const keyword = state.suggestionKeyword as string;
    let items: Mithril.Children[];

    if (keyword === '#') {
      items = (state.suggestionResults as CanelaTag[]).map((tag) =>
        isCategory(tag)
          ? this.assistantItem({ typeClass: 'category', category: tag, slug: `#${this.tagSlug(tag)}`, keyword, searchAllTopics: true })
          : this.assistantItem({ typeClass: 'tag', tag, slug: `#${tag.slug()}`, keyword, searchAllTopics: true })
      );
    } else if (keyword === '@') {
      items = (state.suggestionResults as User[]).map((user) =>
        this.assistantItem({ typeClass: 'user', user, slug: `@${user.username()}`, keyword, searchAllTopics: true })
      );
    } else {
      const last = state.term.split(' ').slice(-1)[0] || '';

      items = suggestionShortcuts()
        .filter((item) => item.includes(last))
        .slice(0, 8)
        .map((item) => this.assistantItem({ typeClass: 'shortcut', label: item, slug: item, keyword, searchAllTopics: true }));
    }

    return <ul className="search-menu-assistant">{items}</ul>;
  }

  /** "pai:filha", como o Discourse escreve a subcategoria. */
  tagSlug(tag: CanelaTag): string {
    const parent = tag.isChild() ? (tag.parent() as CanelaTag | null) : null;

    return parent ? `${parent.slug()}:${tag.slug()}` : tag.slug();
  }

  /** A página de categoria (ou etiqueta) é o contexto da busca, como no Discourse. */
  contextItem(): Mithril.Children {
    const tag = currentTag();

    if (!tag) return null;

    return isCategory(tag)
      ? this.assistantItem({ typeClass: 'category', category: tag, slug: `#${this.tagSlug(tag)}`, keyword: '#', withInLabel: true })
      : this.assistantItem({ typeClass: 'tag', tag, slug: `#${tag.slug()}`, keyword: '#', withInLabel: true });
  }

  /** `search-menu/results/initial-options.gjs`. */
  initialOptions(): Mithril.Children {
    const term = state.term.trim();
    const context = this.contextItem();
    let items: Mithril.Children[];

    if (term && MODIFIER_REGEXP.test(term)) {
      items = [this.assistantItem({ extraHint: true })];
    } else if (term) {
      items = [this.assistantItem({ extraHint: true, searchAllTopics: true, suffix: t('search_menu.in_topics_posts') }), context];
    } else if (context) {
      items = [context, this.recentSearches()];
    } else {
      items = [this.randomTip(), this.recentSearches()];
    }

    return <ul className="search-menu-initial-options">{items}</ul>;
  }

  randomTip(): Mithril.Children {
    const tip = this.tip;

    if (!tip) return null;

    return (
      <li className="search-random-quick-tip">
        <button
          type="button"
          aria-describedby="tip-description"
          className={classList('tip-label', { 'tip-clickable': tip.clickable })}
          onclick={(event: MouseEvent) => {
            if (!tip.clickable || !tip.label) return;

            event.preventDefault();
            event.stopPropagation();
            state.setTerm(tip.label);
            this.attrs.menu.input()?.focus();
          }}
        >
          {/* eslint-disable-next-line i18n/no-hardcoded-text -- nome da tecla Enter, igual em todo idioma */}
          {tip.shortcut ? [<kbd>{isMac() ? '⌘' : 'Ctrl'}</kbd>, '+', <kbd>Enter</kbd>] : tip.label}
        </button>{' '}
        <span id="tip-description">{tip.description}</span>
      </li>
    );
  }

  recentSearches(): Mithril.Children {
    const recents = recentSearches();

    if (!recents.length) return null;

    return (
      <div className="search-menu-recent">
        {recents.map((term) => this.assistantItem({ concatSlug: true, label: term, slug: term }))}
        <button
          type="button"
          className="btn-transparent btn-small clear-recent-searches"
          onclick={() => {
            clearRecentSearches();
            this.attrs.menu.input()?.focus();
          }}
        >
          {t('search_menu.clear_recent')}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Tipos de resultado (`search-menu/results/types.gjs`)
  // ---------------------------------------------------------------------

  resultLink(href: string, content: Mithril.Children, className = 'search-link'): Mithril.Children {
    return (
      <Link
        className={className}
        href={href}
        onclick={(event: MouseEvent) => {
          if (!wantsNewWindow(event)) this.attrs.menu.close();
        }}
      >
        {content}
      </Link>
    );
  }

  quickResults(): Mithril.Children {
    const results = state.results!;
    const label = t('search_menu.results');

    return [
      results.categories.length > 0 && (
        <div className="search-result-category">
          <ul className="list" aria-label={`${label} category`}>
            {results.categories.map((tag) => (
              <li className="item">{this.resultLink(tagUrl(tag), categoryBadge(tag, false))}</li>
            ))}
          </ul>
        </div>
      ),
      results.tags.length > 0 && (
        <div className="search-result-tag">
          <ul className="list" aria-label={`${label} tag`}>
            {results.tags.map((tag) => (
              <li className="item">
                {this.resultLink(tagUrl(tag), [tagSymbol(tag, '', 'fas fa-tag'), <span className="discourse-tag">{tag.name()}</span>])}
              </li>
            ))}
          </ul>
        </div>
      ),
      results.users.length > 0 && (
        <div className="search-result-user">
          <ul className="list" aria-label={`${label} user`}>
            {results.users.map((user) => (
              <li className="item">{this.resultLink(app.route.user(user), this.userView(user, true))}</li>
            ))}
          </ul>
        </div>
      ),
    ];
  }

  /** `search-menu/results/type/user.gjs`: avatar pequeno, nome (em negrito) e @usuário. */
  userView(user: User, withName: boolean): Mithril.Children {
    const name = user.displayName();
    const showName = withName && !!name && name !== user.username();

    return [
      <Avatar user={user} className="avatar" />,
      <div className="user-titles">
        {showName ? <span className="name">{name}</span> : null}
        <span className="username">{user.username()}</span>
      </div>,
    ];
  }

  topicResults(topics: Discussion[], text: string): Mithril.Children {
    const phrase = text ? escapeRegExp(text) : '';
    const regexp = phrase ? new RegExp(`${phrase}|${phrase.trim().replace(/\s+/g, '|')}`, 'gi') : undefined;

    return (
      <div className="search-result-topic">
        <ul className="list" aria-label={`${t('search_menu.results')} topic`}>
          {topics.map((discussion) => {
            const post = discussion.mostRelevantPost() || discussion.firstPost();
            const comment = post && post.contentType() === 'comment' ? post : null;
            const href = app.route.discussion(discussion, text && comment ? comment.number() : undefined);
            const date = comment?.createdAt() || discussion.createdAt();

            return (
              <li className="item">
                {this.resultLink(href, [
                  <span className="topic">
                    <span className="first-line">
                      {this.topicStatuses(discussion)}
                      <span className="topic-title" data-topic-id={discussion.id()}>
                        {highlight(discussion.title(), regexp)}
                      </span>
                    </span>
                    <span className="second-line">{discussionBadges(discussion, false)}</span>
                  </span>,
                  <span className="blurb">
                    <span className="relative-date">{shortAge(date)}</span>
                    <span className="blurb__separator"> - </span>
                    <span className="blurb__text">{comment ? highlight(comment.contentPlain() ?? '', regexp, 175) : null}</span>
                  </span>,
                ])}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /** Os ícones cinza pequenos antes do título (`TopicStatus`): trancado e fixado. */
  topicStatuses(discussion: Discussion): Mithril.Children {
    const statuses: Mithril.Children[] = [];

    if (discussion.attribute('isLocked')) statuses.push(<span className="topic-status">{<Icon name="fas fa-lock" />}</span>);
    if (discussion.attribute('isSticky')) statuses.push(<span className="topic-status">{<Icon name="fas fa-thumbtack" />}</span>);

    return statuses.length ? <span className="topic-statuses">{statuses}</span> : null;
  }

  /** `search-menu/results/more-link.gjs`: "Mais..." leva à busca de página inteira. */
  moreLink(more: boolean): Mithril.Children {
    return (
      <div className="search-menu__show-more">
        {more ? this.resultLink(fullSearchUrl(state.term), `${t('search_menu.more')}...`, 'filter search-link') : null}
      </div>
    );
  }
}
