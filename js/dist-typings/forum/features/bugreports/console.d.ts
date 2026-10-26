export interface ConsoleEntry {
    at: string;
    message: string;
}
/** A interface do próprio recurso: nunca entra na captura nem no contexto. */
export declare const UI_ATTR = "data-bug-ui";
/** Passa a guardar os erros do console e as exceções do último minuto. */
export declare function installConsoleCapture(): void;
export declare function recentConsoleErrors(): ConsoleEntry[];
