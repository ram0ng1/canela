type Gate = {
    matches: (namespace: string, url: string) => boolean;
    load: () => Promise<unknown>;
};
/** Uma vez só por carga: a promessa fica guardada (e é refeita se falhar). */
export declare function once<T>(load: () => Promise<T>): () => Promise<T>;
export declare function beforeChunk(matches: Gate['matches'], load: () => Promise<unknown>): void;
export {};
