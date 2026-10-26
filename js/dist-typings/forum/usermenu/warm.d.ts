export declare function warmNotifications(): Promise<void>;
export declare function warmDialogs(): Promise<void>;
export declare function warmFlags(): Promise<void>;
/** Os marcadores do menu: guardados entre aberturas, revalidados a cada uma. */
export declare const bookmarks: {
    items: any[];
    loaded: boolean;
    pending: Promise<void> | null;
};
/** A primeira busca; com `refresh`, também a revalidação (ao abrir o menu). */
export declare function warmBookmarks(refresh?: boolean): Promise<void>;
/**
 * Todas as abas: ao apontar o avatar e ao abrir o menu (`refresh`). As listas
 * dos estados só buscam de novo quando há algo novo; os marcadores, que não
 * têm contador, a cada abertura.
 */
export declare function warmMenu(refresh?: boolean): void;
/**
 * A aba padrão — e o que `also` pedir (o chunk do menu aberto) —, uma vez por
 * sessão, quando a página fica ociosa.
 */
export declare function warmWhenIdle(also?: () => void): void;
