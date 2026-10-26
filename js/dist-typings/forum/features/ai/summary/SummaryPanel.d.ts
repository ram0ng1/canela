import type Discussion from 'flarum/common/models/Discussion';
interface SummaryData {
    text: string;
    updatedAt: string | null;
    model: string | null;
    outdated: boolean;
    newPostsSinceSummary: number;
    canRegenerate: boolean;
}
declare class SummaryState {
    discussion: Discussion | null;
    open: boolean;
    closing: boolean;
    loading: boolean;
    /** O "●" no fim e o rodapé escondido: enquanto o texto ainda está aparecendo. */
    streaming: boolean;
    /** O que já aparece na tela. */
    text: string;
    /** Tudo o que chegou do servidor; `text` corre atrás dele. */
    target: string;
    /** O resumo completo já chegou. */
    completed: boolean;
    /** Chegaram pedaços da geração (e não só o resumo pronto). */
    generated: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    summary: SummaryData | null;
    controller: AbortController | null;
    show(discussion: Discussion): void;
    hide(): void;
    reset(): void;
    /**
     * O texto aparece letra a letra: os pedaços do modelo
     * chegam aos trancos (às vezes uma frase inteira de uma vez), e o resumo já
     * pronto chegava inteiro, sem animação nenhuma.
     */
    receive(text: string, completed: boolean): void;
    typeCharacter(): void;
    stopTyping(): void;
    request(regenerate: boolean): void;
}
export declare const summaryState: SummaryState;
export {};
