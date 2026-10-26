/** Rota → ordenação. "Novos" é a lista dos mais novos. */
export declare const SORT_ROUTES: Record<string, string>;
/** A rota de uma ordenação, se houver. */
export declare function routeForSort(sort: string): string | null;
export declare function currentSortRoute(): string | null;
export default function installRoutes(): void;
