export declare const DEFAULT_TAB = "all-notifications";
declare class UserMenuState {
    open: boolean;
    tab: string;
    /** A rota de quando abriu: ao navegar, o menu fecha. */
    route: string | null;
    /** Devolver o foco ao avatar só quando quem fechou foi o teclado. */
    restoreFocus: boolean;
    show(): void;
    close(restoreFocus?: boolean): void;
    toggle(): void;
}
export declare const userMenu: UserMenuState;
export {};
