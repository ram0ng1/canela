import { type CanelaTag } from '../../../utils/tags';
export type SearchStatus = '' | 'open' | 'closed' | 'sticky';
export interface SearchQuery {
    /** O texto livre, sem os gambits. */
    text: string;
    author: string;
    category: string;
    tags: string[];
    inTitle: boolean;
    liked: boolean;
    bookmarked: boolean;
    unread: boolean;
    status: SearchStatus;
    /** YYYY-MM-DD */
    after: string;
    before: string;
    minPosts: string;
    /** Filtros de outras extensões (ou digitados à mão) que a página não edita. */
    extra: Record<string, unknown>;
}
export declare function emptyQuery(): SearchQuery;
/** Categoria = tag primária (com posição) ou filha de uma. */
export declare function isCategory(tag: CanelaTag): boolean;
export declare function parseQuery(raw: string): SearchQuery;
/** Os filtros da API equivalentes à consulta (sem o texto livre). */
export declare function queryFilters(query: SearchQuery): Record<string, any>;
/**
 * A consulta como texto, com os gambits traduzidos.
 *
 * Não usa `GambitManager.from`: ele perde o "-" de um filtro negado (o
 * `-é:trancada` dos tópicos abertos) quando há mais de um gambit registrado.
 */
export declare function serializeQuery(query: SearchQuery): string;
/** Há algo para pesquisar? Só filtros também vale. */
export declare function hasCriteria(query: SearchQuery): boolean;
/** As palavras do texto livre, para destacar nos resultados. */
export declare function highlightPattern(text: string): RegExp | undefined;
