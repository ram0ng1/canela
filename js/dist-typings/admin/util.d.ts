import Component, { type ComponentAttrs } from 'flarum/common/Component';
/** Os controles recebem attrs de formato livre (settingKey, label, help…). */
export type LooseAttrs = ComponentAttrs & Record<string, any>;
export declare abstract class AdminComponent<A extends LooseAttrs = LooseAttrs> extends Component<A> {
}
export declare const settings: () => Record<string, any>;
export declare const trans: (key: string, params?: Record<string, any>) => string;
export declare const getBool: (key: string) => boolean;
export declare const getStr: (key: string, fallback?: string) => string;
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
/** Estado da gravação, lido pelo indicador da barra do painel. */
export declare const saveState: {
    status: SaveStatus;
    pending: number;
};
export declare const noteInteraction: (target: EventTarget | null) => void;
/** Grava direto na API — todos os controles do painel salvam sozinhos. */
export declare const saveSetting: (payload: Record<string, any>) => Promise<unknown>;
export declare const extensionName: (id: string) => string;
export declare const extensionInstalled: (id: string) => boolean;
export declare const extensionOn: (id: string) => boolean;
/** A primeira extensão da lista que está desligada (ou não instalada). */
export declare const missingExtension: (ids?: string[]) => string | null;
interface DepEntry {
    deps: string[];
    extensions: string[];
    locked?: () => string | null;
}
export declare const toList: (value?: string | string[]) => string[];
export declare const registerDeps: (key: string, entry: Partial<DepEntry>) => void;
/** A chave está ligada E tudo de que ela depende também (recursivo). */
export declare const isOn: (key: string, seen?: Set<string>) => boolean;
/** A primeira dependência desligada da lista, ou `null` quando todas valem. */
export declare const firstOff: (deps?: string | string[]) => string | null;
/** Desenha os filhos só se as dependências valem — as opções que dependem de algo desligado somem. */
export declare const when: (deps: string | string[], children: any) => any;
export {};
