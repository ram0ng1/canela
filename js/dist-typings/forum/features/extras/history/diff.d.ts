export type DiffKind = 'equal' | 'insert' | 'delete';
export interface DiffPart {
    kind: DiffKind;
    text: string;
}
export declare function tokenize(text: string): string[];
export declare function diffWords(before: string, after: string): DiffPart[];
/** Quantas palavras entraram e saíram — o resumo "+12 −3" do cabeçalho. */
export declare function diffStats(parts: DiffPart[]): {
    added: number;
    removed: number;
};
