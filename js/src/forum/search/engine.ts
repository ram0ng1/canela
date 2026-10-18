/*
 * O motor do menu de busca (chunk do SearchPanel): a espera entre as teclas,
 * as sugestões de "#", "@" e "chave:", e os pedidos à API. O estado (termo e
 * resultados) mora em state.ts, no pacote principal, porque o campo do
 * cabeçalho o desenha desde a primeira pintura.
 */
import app from 'flarum/forum/app';
import SearchManager from 'flarum/common/SearchManager';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';

import { allTags, isTagsEnabled, type CanelaTag } from '../utils/tags';
import { CATEGORY_SLUG_REGEXP, discussionFilter, SUGGESTIONS_REGEXP, USERNAME_REGEXP } from './query';
import { addRecentSearch } from './assist';
import type { SearchMenuState, SearchResults } from './state';

/** Quantos itens o Discourse mostra por tipo no menu (`Search.per_facet`). */
export const PER_FACET = 5;
const DEBOUNCE_MS = 400;

type SuggestionMatch = { type: 'category'; text: string } | { type: 'user'; text: string } | { type: 'shortcut'; keyword: string };

/** Minúsculas e sem acentos: "Notícias" casa com "noticias". */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Categoria = tag primária ou filha de uma (como na página de busca do tema). */
export function isCategory(tag: CanelaTag): boolean {
  return tag.position() !== null || tag.isChild();
}

function matchingTags(text: string, limit: number): { categories: CanelaTag[]; tags: CanelaTag[] } {
  if (!isTagsEnabled()) return { categories: [], tags: [] };

  const wanted = normalize(text.trim());
  const found = allTags().filter((tag) => !wanted || normalize(tag.name()).includes(wanted) || normalize(tag.slug()).includes(wanted));
  // Quem começa com o texto vem antes de quem só o contém.
  const starts = (tag: CanelaTag) => (normalize(tag.name()).startsWith(wanted) || normalize(tag.slug()).startsWith(wanted) ? 0 : 1);
  const sorted = found.sort((a, b) => starts(a) - starts(b) || b.discussionCount() - a.discussionCount());

  return {
    categories: sorted.filter(isCategory).slice(0, limit),
    tags: sorted.filter((tag) => !isCategory(tag)).slice(0, limit),
  };
}

function canSearchUsers(): boolean {
  return !!app.forum.attribute('canSearchUsers');
}

/** Termos curtos demais não buscam, a menos que tenham um filtro (como o Discourse). */
function isValidTerm(term: string): boolean {
  const trimmed = term.trim();

  if (!trimmed) return false;
  if (/[#@:]/.test(trimmed)) return true;

  return trimmed.length >= SearchManager.minSearchLength();
}

/** O trabalho de `SearchMenuState.trigger()`, com o mesmo estado (um só, compartilhado pelos menus). */
class Engine {
  private timer?: number;
  private request = 0;

  constructor(private readonly state: SearchMenuState) {}

  trigger(): void {
    const state = this.state;

    window.clearTimeout(this.timer);

    if (state.searchTopics) {
      state.loading = true;
      this.perform();
      addRecentSearch(state.term);
    } else {
      state.loading = false;
      this.timer = window.setTimeout(() => this.perform(), DEBOUNCE_MS);
    }
  }

  matchSuggestions(): SuggestionMatch | null {
    if (this.state.searchTopics) return null;

    const term = this.state.term.trim();
    const category = isTagsEnabled() ? term.match(CATEGORY_SLUG_REGEXP) : null;

    if (category) return { type: 'category', text: category[0].slice(1).split(':').pop() || '' };

    const user = term.match(USERNAME_REGEXP);

    if (user) return { type: 'user', text: user[0].slice(1) };

    const shortcut = term.match(SUGGESTIONS_REGEXP);

    if (shortcut) return { type: 'shortcut', keyword: shortcut[0] };

    return null;
  }

  async perform(): Promise<void> {
    const id = ++this.request;
    const current = () => id === this.request;
    const suggestion = this.matchSuggestions();

    if (suggestion) {
      this.state.noResults = true;
      this.state.results = null;
      this.state.loading = false;
      this.state.suggestionResults = [];

      if (suggestion.type === 'category') {
        const { categories, tags } = matchingTags(suggestion.text, 8);

        this.state.suggestionResults = [...categories, ...tags].slice(0, 8);
        this.state.suggestionKeyword = '#';
      } else if (suggestion.type === 'user') {
        this.state.suggestionKeyword = false;

        const users = await this.findUsers(suggestion.text, 6);

        if (!current()) return;

        if (users.length) {
          this.state.suggestionResults = users;
          this.state.suggestionKeyword = '@';
        }
      } else {
        this.state.suggestionKeyword = suggestion.keyword;
      }

      m.redraw();
      return;
    }

    this.state.suggestionKeyword = false;

    if (!this.state.term.trim()) {
      this.state.noResults = false;
      this.state.results = null;
      this.state.loading = false;
      this.state.invalidTerm = false;
      m.redraw();
      return;
    }

    if (!isValidTerm(this.state.term)) {
      this.state.noResults = true;
      this.state.results = null;
      this.state.loading = false;
      this.state.invalidTerm = true;
      m.redraw();
      return;
    }

    this.state.loading = true;
    this.state.invalidTerm = false;
    m.redraw();

    try {
      const results = this.state.searchTopics ? await this.findTopics(this.state.term) : await this.findQuick(this.state.term);

      if (!current()) return;

      this.state.results = results;
      this.state.noResults = !results.topics.length && !results.categories.length && !results.tags.length && !results.users.length;
    } catch {
      if (!current()) return;

      this.state.results = null;
      this.state.noResults = true;
    } finally {
      if (current()) {
        this.state.loading = false;
        m.redraw();
      }
    }
  }

  async findUsers(text: string, limit: number): Promise<User[]> {
    if (!canSearchUsers()) return [];

    try {
      // Sem texto (só "@"), o Discourse sugere quem passou por aqui por último.
      const params = text ? { filter: { q: text }, page: { limit } } : { sort: '-lastSeenAt', page: { limit } };

      return await app.store.find<User[]>('users', params as any);
    } catch {
      return [];
    }
  }

  async findQuick(term: string): Promise<SearchResults> {
    const { text } = discussionFilter(term);
    const { categories, tags } = text ? matchingTags(text, PER_FACET) : { categories: [], tags: [] };
    const users = text ? await this.findUsers(text, PER_FACET) : [];

    return { text, topics: [], moreTopics: false, categories, tags, users };
  }

  async findTopics(term: string): Promise<SearchResults> {
    const { filter, text } = discussionFilter(term);
    const include = ['mostRelevantPost', 'user', ...(isTagsEnabled() ? ['tags'] : [])].join(',');
    const topics = await app.store.find<Discussion[]>('discussions', { filter, page: { limit: PER_FACET }, include } as any);
    const moreTopics = !!(topics as any).payload?.links?.next;

    return { text, topics, moreTopics, categories: [], tags: [], users: [] };
  }
}

const engines = new WeakMap<SearchMenuState, Engine>();

export function trigger(state: SearchMenuState): void {
  let engine = engines.get(state);

  if (!engine) engines.set(state, (engine = new Engine(state)));

  engine.trigger();
}
