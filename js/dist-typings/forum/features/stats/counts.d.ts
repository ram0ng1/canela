/** O servidor para de contar aqui; a partir disso a aba mostra "99+". */
export declare const COUNT_LIMIT = 100;
export declare function countsEnabled(): boolean;
export declare function newCount(scope?: 'global' | 'page'): number;
export declare function unreadCount(scope?: 'global' | 'page'): number;
/** "3", ou "99+" quando o servidor parou de contar. */
export declare function formatCount(count: number): string;
export declare function refreshCounts(force?: boolean): Promise<void>;
