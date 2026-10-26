export declare const SHELL_CLASS = "Canela";
export declare const OPEN_CLASS = "Canela--sidebarOpen";
export declare const OVERLAY_CLASS = "Canela--sidebarOverlay";
export declare function isDocked(): boolean;
export declare function isSidebarOpen(): boolean;
export declare function applySidebarState(): void;
export declare function toggleSidebar(): void;
/** Fecha o painel sobreposto — ao navegar ou clicar fora dele. */
export declare function closeOverlaySidebar(): void;
export declare function watchViewport(): void;
