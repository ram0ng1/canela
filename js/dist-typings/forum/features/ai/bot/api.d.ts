import type { AiConversation, AiMessage } from './ConversationsState';
/** Uma página da lista (50 por vez); `hasMore` vem do `links.next`. */
export declare function fetchConversations(offset: number): Promise<{
    data: AiConversation[];
    hasMore: boolean;
}>;
/** A conversa e as mensagens, na ordem em que o servidor as relaciona. */
export declare function fetchConversation(id: string): Promise<{
    conversation: AiConversation;
    messages: AiMessage[];
}>;
export declare function renameConversation(id: string, title: string): Promise<AiConversation>;
export declare function deleteConversation(id: string): Promise<void>;
