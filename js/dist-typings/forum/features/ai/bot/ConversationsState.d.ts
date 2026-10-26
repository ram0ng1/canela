import type { ToolActivity } from '../ui';
export interface AiConversation {
    id: string;
    title: string | null;
    persona: string | null;
    messageCount: number;
    createdAt: string | null;
    updatedAt: string | null;
}
export interface AiMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tools: ToolActivity[];
    model: string | null;
    createdAt: string | null;
    /** Ainda chegando (a resposta em streaming). */
    streaming?: boolean;
}
declare class ConversationsState {
    conversations: AiConversation[];
    loaded: boolean;
    loading: boolean;
    hasMore: boolean;
    /** A conversa aberta (null na tela de "Nova pergunta"). */
    currentId: string | null;
    messages: AiMessage[];
    loadingMessages: boolean;
    missing: boolean;
    /** A resposta em andamento: a conversa a que pertence e o cancelamento. */
    sending: boolean;
    sendingFor: string | null;
    controller: AbortController | null;
    /** O que a página pediu para mandar assim que abrir (o "Perguntar à IA" da busca). */
    pendingQuestion: string | null;
    /** A pergunta que não chegou ao servidor (erro), de volta para o campo. */
    restoreQuestion: string | null;
    persona: string | null;
    loadList(more?: boolean): void;
    open(id: string | null): void;
    current(): AiConversation | null;
    personaFor(conversation: AiConversation | null): string | null;
    send(question: string): Promise<void>;
    stop(): void;
    rename(conversation: AiConversation, title: string): Promise<void>;
    remove(conversation: AiConversation): Promise<void>;
    private handleLine;
    private upsert;
    /** O limite diário mostrado no fórum desce a cada pergunta. */
    private refreshRemaining;
}
export declare const conversations: ConversationsState;
export {};
