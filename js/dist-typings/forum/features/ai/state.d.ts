export interface AiPersona {
    id: string;
    name: string;
    description: string;
}
export interface AiInfo {
    bot: boolean;
    botHeaderIcon: boolean;
    botSidebarLink: boolean;
    search: boolean;
    helper: boolean;
    summary: boolean;
    gists: boolean;
    related: boolean;
    canUse: boolean;
    canSummarize: boolean;
    remaining: number | null;
    personas: AiPersona[];
    defaultPersona: string | null;
    model: string;
}
export type AiFeature = 'bot' | 'search' | 'helper' | 'summary' | 'gists' | 'related';
export declare function aiInfo(): AiInfo | null;
/** O recurso vale para todos (resumos prontos, gists, relacionados). */
export declare function aiFeature(feature: AiFeature): boolean;
/** O recurso vale e a pessoa pode usá-lo (bot, busca, ajudante). */
export declare function aiUsable(feature: 'bot' | 'search' | 'helper'): boolean;
export declare function aiApiUrl(path: string): string;
export declare function aiRequest<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, unknown>): Promise<T>;
export interface StreamLine {
    type: string;
    [key: string]: any;
}
/**
 * POST que lê a resposta enquanto ela é escrita.
 *
 * O `app.request` só entrega o corpo inteiro, no fim; aqui cada linha (um
 * objeto JSON completo) vai para `onLine` assim que chega — é o que dá o
 * efeito de "digitando". Um erro antes do stream (422 do limite,
 * 403…) vira uma exceção com a mensagem da API, para o alerta.
 */
export declare function aiStream(path: string, body: Record<string, unknown>, onLine: (line: StreamLine) => void, signal?: AbortSignal): Promise<void>;
export declare class AiStreamError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/** O alerta de erro de um pedido à IA, com a mensagem da API quando houver. */
export declare function showAiError(error: unknown): void;
