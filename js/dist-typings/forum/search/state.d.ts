import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type { CanelaTag } from '../utils/tags';
export interface SearchResults {
    /** O texto livre (sem gambits), para destacar nos títulos e trechos. */
    text: string;
    topics: Discussion[];
    moreTopics: boolean;
    categories: CanelaTag[];
    tags: CanelaTag[];
    users: User[];
}
export declare class SearchMenuState {
    term: string;
    /** A busca já inclui os tópicos. */
    searchTopics: boolean;
    loading: boolean;
    invalidTerm: boolean;
    noResults: boolean;
    results: SearchResults | null;
    /** "#", "@" ou o atalho digitado ("é:"): o assistente aparece no lugar dos resultados. */
    suggestionKeyword: string | false;
    suggestionResults: Array<CanelaTag | User>;
    /** Troca o termo da busca. */
    setTerm(term: string, opts?: {
        searchTopics?: boolean;
    }): void;
    /** Enter: a mesma consulta, agora com os tópicos. */
    searchTopicsNow(): void;
    clear(): void;
    trigger(): void;
}
declare const state: SearchMenuState;
export default state;
