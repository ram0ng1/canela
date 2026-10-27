import type { ChatChannel, ChatMessage, ChatThread, ChatUpload, NotificationLevel, ThreadLevel } from './types';
type Options = Record<string, unknown>;
/** Sem alerta de erro: para as chamadas de fundo (estado, polling, "lido"). */
export declare const quiet: Options;
export declare function state(options?: Options): Promise<{
    channels: ChatChannel[];
}>;
export declare function browse(filter: {
    status?: string;
    q?: string;
}, offset?: number): Promise<{
    channels: ChatChannel[];
    hasMore: boolean;
}>;
export declare function channel(id: number, options?: Options): Promise<{
    channel: ChatChannel;
}>;
export declare function createChannel(attributes: Record<string, unknown>): Promise<{
    channel: ChatChannel;
}>;
export declare function updateChannel(id: number, attributes: Record<string, unknown>): Promise<{
    channel: ChatChannel;
}>;
export declare function deleteChannel(id: number): Promise<void>;
/** Abre (ou reabre) a MD com essas pessoas; com `name`, um chat em grupo novo. */
export declare function openDirect(userIds: number[], name?: string): Promise<{
    channel: ChatChannel;
}>;
export declare function follow(id: number): Promise<{
    channel: ChatChannel;
}>;
export declare function updateMembership(id: number, attributes: {
    muted?: boolean;
    starred?: boolean;
    notificationLevel?: NotificationLevel;
}): Promise<{
    channel: ChatChannel;
}>;
/** Sair do canal; de um grupo de MD, o canal some (e a resposta vem vazia). */
export declare function leave(id: number): Promise<{
    channel: ChatChannel | null;
}>;
export declare function members(id: number, q: string, offset?: number): Promise<{
    memberIds: number[];
    hasMore: boolean;
    total: number;
}>;
export declare function addMembers(id: number, userIds: number[]): Promise<{
    channel: ChatChannel;
}>;
export declare function markRead(id: number, messageId?: number, options?: Options): Promise<{
    channel: ChatChannel;
}>;
export declare function typing(id: number, isTyping: boolean, threadId: number | null): Promise<void>;
export declare function pins(id: number, options?: Options): Promise<{
    messages: ChatMessage[];
}>;
export declare function pinsRead(id: number): Promise<void>;
/** O polling sem websocket: as novas, as que mudaram, as que sumiram e quem está digitando. */
export declare function updates(id: number, filter: {
    after?: number;
    since?: string | null;
    thread?: number | null;
}): Promise<{
    messages: ChatMessage[];
    changed: ChatMessage[];
    removedIds: number[];
    typingUserIds: number[];
    now: string;
}>;
export type MessagesMeta = {
    canLoadMorePast: boolean;
    canLoadMoreFuture: boolean;
    targetMessageId: number | null;
};
/** Uma página de mensagens por cursor (`around`, `before` ou `after`). */
export declare function messages(channelId: number, page: {
    around?: number | null;
    before?: number;
    after?: number;
    limit?: number;
}, threadId?: number | null): Promise<{
    messages: ChatMessage[];
    meta: MessagesMeta;
}>;
export declare function sendMessage(channelId: number, attributes: {
    message: string;
    inReplyToId: number | null;
    threadId: number | null;
    uploadIds: number[];
}, options?: Options): Promise<{
    message: ChatMessage;
}>;
export declare function message(id: number, options?: Options): Promise<{
    message: ChatMessage;
}>;
export declare function updateMessage(id: number, attributes: {
    message: string;
    uploadIds: number[];
}): Promise<{
    message: ChatMessage;
}>;
/** Apagar é brando: a resposta é a mensagem como ficou (recolhida para o autor e a moderação). */
export declare function deleteMessage(id: number): Promise<{
    message: ChatMessage;
}>;
export declare function restoreMessage(id: number): Promise<{
    message: ChatMessage;
}>;
export declare function react(id: number, emoji: string, action: 'add' | 'remove'): Promise<{
    message: ChatMessage;
}>;
export declare function pin(id: number, value: boolean): Promise<{
    message: ChatMessage;
}>;
/** "Pesquisar no chat": os resultados e os canais deles. */
export declare function search(q: string, sort: string, channelId?: number): Promise<{
    results: ChatMessage[];
    channels: ChatChannel[];
}>;
/** Os fios de um canal, ou — sem canal — os que o leitor acompanha, com os canais deles. */
export declare function threads(channelId?: number): Promise<{
    threads: ChatThread[];
    channels: ChatChannel[];
}>;
export declare function fetchThread(id: number): Promise<{
    thread: ChatThread;
}>;
export declare function updateThread(id: number, attributes: {
    title?: string | null;
    notificationLevel?: ThreadLevel;
}): Promise<{
    thread: ChatThread;
}>;
export declare function markThreadRead(id: number, messageId?: number, options?: Options): Promise<{
    thread: ChatThread;
}>;
/** A busca de pessoas do chat (o `@` e "Nova mensagem"); com o canal, quem é membro. */
export declare function users(q: string, channelId?: number): Promise<{
    userIds: number[];
    memberIds: number[];
}>;
/** Envia uma imagem do composer (multipart): ela fica solta até a mensagem sair. */
export declare function upload(file: File): Promise<{
    upload: ChatUpload;
}>;
export {};
