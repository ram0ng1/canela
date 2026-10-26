import type Discussion from 'flarum/common/models/Discussion';
declare class BulkSelection {
    active: boolean;
    /** Sobe a cada mudança: é o que os itens da lista (SubtreeRetainer) observam. */
    version: number;
    private ids;
    /** Último item clicado, para o shift+clique selecionar o intervalo. */
    private anchor;
    has(discussion: Discussion): boolean;
    count(): number;
    setActive(active: boolean): void;
    toggle(discussion: Discussion, range?: boolean): void;
    selectAll(): void;
    clear(): void;
    /** Os tópicos marcados que ainda estão no store (um excluído some daqui). */
    selected(): Discussion[];
    forget(discussion: Discussion): void;
}
export declare const selection: BulkSelection;
/** Os tópicos já carregados na lista, na ordem em que aparecem. */
export declare function loadedDiscussions(): Discussion[];
/** Quem modera algo nesta lista — a equipe ("staff"). */
export declare function canModerate(discussion: Discussion): boolean;
export declare function bulkAvailable(): boolean;
export {};
