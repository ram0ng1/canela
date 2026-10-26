/** Os idiomas que a pessoa lê sem tradução (na conta; no navegador, para visitantes). */
export declare function understoodLocales(): string[];
/** "Traduzir automaticamente": desligado, o tópico abre no original. */
export declare function autoTranslate(): boolean;
export declare function saveContentLanguagePreferences(understood: string[], auto: boolean): Promise<unknown>;
/** O valor original do modelo, sem a tradução (para editar e comparar). */
export declare function withOriginal<T>(callback: () => T): T;
export default function installTranslation(): void;
