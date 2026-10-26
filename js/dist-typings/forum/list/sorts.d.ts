export declare const HOT_SORT = "hot";
export declare const UNREAD_SORT = "unread";
/** As ordenações do core — o que sobra no sortMap veio de extensões. */
export declare const CORE_SORTS: string[];
export default function installSorts(): void;
/** O rótulo de uma ordenação como o core monta no dropdown dele. */
export declare function sortLabel(key: string): string;
export declare function activeSort(): string;
