export interface ChatReport {
    /** `chat-<id da mensagem>`: a chave do item na lista. */
    key: string;
    message: any;
    /** Todas as denúncias abertas da mensagem, a mais recente primeiro. */
    flags: any[];
    /** A denúncia mais recente: a posição do item na fila. */
    date: Date;
}
/**
 * As denúncias abertas, uma entrada por mensagem. Recusado (403: o
 * ramon/chat de hoje só atende `ramon-chat.moderate`), devolve vazio sem
 * alerta — o pedido não foi do leitor.
 */
export declare function loadChatReports(): Promise<ChatReport[]>;
/** A fila "Revisar" já filtrada nas denúncias do chat, quando elas estão nela. */
export declare function reviewHref(): string | null;
