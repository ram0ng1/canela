import type Application from 'flarum/common/Application';
import type { IExtensionModule } from 'flarum/common/extenders/IExtender';
/** Rota → ordenação. "Novos" é a lista dos mais novos. */
export declare const SORT_ROUTES: Record<string, string>;
/** A rota de uma ordenação, se houver. */
export declare function routeForSort(sort: string): string | null;
export declare function currentSortRoute(): string | null;
/** As rotas das listas (extenders do fórum, em ./extend.ts). */
export declare const listRoutes: {
    extend(app: Application, extension: IExtensionModule): void;
};
export default function installRoutes(): void;
