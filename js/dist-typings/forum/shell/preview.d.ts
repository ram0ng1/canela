export interface PreviewState {
    layout?: string;
    forumBackground?: string;
    authBackground?: string;
    texts?: Record<string, string>;
}
export declare function previewState(): PreviewState | null;
/** O texto do rascunho (para o atributo dado), ou `undefined` sem pré-visualização. */
export declare function previewText(attribute: string): string | undefined;
export declare function decodePreview(value: string): PreviewState | null;
/** Lê o parâmetro uma vez, no boot (depois da sessão). */
export declare function readPreview(): void;
