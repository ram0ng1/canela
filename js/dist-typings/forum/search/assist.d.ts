export declare function recentSearches(): string[];
export declare function addRecentSearch(term: string): void;
export declare function clearRecentSearches(): void;
/**
 * Todos os atalhos, nesta ordem: primeiro os
 * booleanos já completos ("é:fixada"), depois as chaves que pedem um valor
 * ("criado:") — exceto autor e tag, que já têm `@` e `#`.
 */
export declare function suggestionShortcuts(): string[];
export interface QuickTip {
    label?: string;
    shortcut?: boolean;
    description: string;
    clickable?: boolean;
}
export declare function quickTips(): QuickTip[];
export declare function randomTip(): QuickTip | null;
