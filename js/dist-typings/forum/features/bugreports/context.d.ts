import { UI_ATTR, type ConsoleEntry } from './console';
export { UI_ATTR };
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface ElementInfo {
    path: string;
    component: string;
    text: string;
}
export interface ReportContext {
    url: string;
    title: string;
    viewport: {
        w: number;
        h: number;
        dpr: number;
    };
    region: Rect | null;
    userAgent: string;
    language: string;
    route: string;
    theme: string;
    elements: ElementInfo[];
    consoleErrors: ConsoleEntry[];
}
/** A URL sem os parâmetros que costumam carregar segredos. */
export declare function redactUrl(href: string): string;
export declare function buildContext(region: Rect | null, includeConsole: boolean, route: string): ReportContext;
