import type Model from 'flarum/common/Model';
import { type SearchQuery } from './query';
export type SearchTab = 'topics' | 'posts' | 'categories' | 'users';
export declare const PAGE_SIZE = 20;
export interface SortOption {
    key: string;
    /** O valor do `sort` da API; vazio = relevância (a ordem do texto). */
    api: string;
    label: string;
}
export interface SearchPage {
    items: Model[];
    total: number | null;
    hasMore: boolean;
}
export declare function sortOptions(tab: SearchTab, t: (key: string) => string): SortOption[];
/** Os filtros que a busca de POSTAGENS entende: autor, tags, curtidas e marcadores. */
export declare function postFilters(query: SearchQuery): {
    filter: Record<string, any>;
    ignored: boolean;
};
export declare function fetchPage(tab: SearchTab, query: SearchQuery, sort: string, offset: number): Promise<SearchPage>;
