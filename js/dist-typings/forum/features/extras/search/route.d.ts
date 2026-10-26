import type { SearchTab } from './sources';
export declare const SEARCH_ROUTE = "canela.search";
export declare function searchPageEnabled(): boolean;
/** URL da página de busca — usada pelo link do modal e por quem mais quiser. */
export declare function searchUrl(q: string, type?: SearchTab, sort?: string): string;
