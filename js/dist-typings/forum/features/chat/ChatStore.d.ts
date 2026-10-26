import type { ChatChannel, ChatEvent, ChatMessage, ChatRoute, ChatThread, ChatUpload } from './types';
export interface PendingUpload {
    key: string;
    name: string;
    preview: string | null;
    upload: ChatUpload | null;
    error: string | null;
}
/** Uma conversa aberta: a principal de um canal, ou um fio. */
export declare class ChatPane {
    readonly store: ChatStore;
    readonly channelId: number;
    readonly threadId: number | null;
    messages: ChatMessage[];
    loaded: boolean;
    loading: boolean;
    loadingPast: boolean;
    loadingFuture: boolean;
    canLoadMorePast: boolean;
    canLoadMoreFuture: boolean;
    /** A última lida quando a conversa abriu: é ali que fica o "último acesso". */
    lastReadAtOpen: number | null;
    targetMessageId: number | null;
    highlightedId: number | null;
    since: string | null;
    replyTo: ChatMessage | null;
    editing: ChatMessage | null;
    uploads: PendingUpload[];
    sending: boolean;
    text: string;
    /** userId => quando o aviso de "digitando" expira. */
    typing: Map<number, number>;
    typingNames: Map<number, string>;
    atBottom: boolean;
    newSinceAway: number;
    mounted: number;
    private readTimer;
    private pendingRead;
    constructor(store: ChatStore, channelId: number, threadId: number | null);
    get key(): string;
    /** O rascunho é de quem o escreveu: outra conta no mesmo navegador não o vê. */
    get draftKey(): string;
    get channel(): ChatChannel | undefined;
    lastId(): number;
    firstId(): number;
    find(id: number): ChatMessage | undefined;
    saveDraft(text: string): void;
    /** Abre a conversa: em volta da mensagem pedida, da primeira não lida, ou no fim. */
    load(around?: number | null): Promise<void>;
    loadPast(): Promise<void>;
    loadFuture(): Promise<void>;
    /** "Pular para o fim": sem o fim carregado, recarrega a conversa a partir dele. */
    jumpToBottom(): Promise<void>;
    /** Põe (ou troca) a mensagem no lugar certo, pela ordem do id. */
    upsert(message: ChatMessage): void;
    remove(id: number): void;
    /** Se a mensagem pertence a esta conversa. */
    accepts(message: Pick<ChatMessage, 'channelId' | 'threadId' | 'isThreadOriginal'>): boolean;
    send(text: string): Promise<void>;
    post(staged: ChatMessage, inReplyToId: number | null, uploads: ChatUpload[], toThread?: boolean): Promise<void>;
    retry(staged: ChatMessage): void;
    resetComposer(): void;
    startEdit(message: ChatMessage): void;
    startReply(message: ChatMessage): void;
    /** Marca lido até a mensagem, agrupando as chamadas de uma rolagem inteira. */
    markRead(messageId: number): void;
    addFiles(files: FileList | File[]): Promise<void>;
    removeUpload(key: string): void;
    poll(): Promise<void>;
}
interface DrawerState {
    open: boolean;
    expanded: boolean;
    route: ChatRoute;
    width: number;
    height: number;
}
type Listener = (key: string) => void;
export declare class ChatStore {
    channels: Map<number, ChatChannel>;
    loaded: boolean;
    loading: boolean;
    panes: Map<string, ChatPane>;
    threads: Map<number, ChatThread>;
    drawer: DrawerState;
    /** O leitor prefere a página cheia (o último jeito que ele usou). */
    prefersFullPage: boolean;
    /** A conversa ativa da página cheia (para destacar na barra lateral). */
    activeChannelId: number | null;
    private listeners;
    private boundChannel;
    private pollTimer;
    private stateTimer;
    private refreshTimer;
    private lastStateAt;
    private typingSentAt;
    on(event: string, listener: Listener): () => void;
    emit(event: string, key: string): void;
    start(): void;
    loadState(): Promise<void>;
    /** Recarrega o estado daqui a pouco, juntando vários pedidos num só. */
    refreshSoon(): void;
    putChannel(channel: ChatChannel): ChatChannel;
    fetchChannel(id: number): Promise<ChatChannel>;
    publicChannels(): ChatChannel[];
    /** As MDs, da conversa mais recente para a mais antiga. */
    directChannels(): ChatChannel[];
    unread(channel: ChatChannel): number;
    /** O número verde: menções, e toda MD não lida. */
    urgent(channel: ChatChannel): number;
    totals(): {
        urgent: number;
        mentions: number;
        unread: boolean;
        threads: number;
        dmUrgent: number;
        publicUrgent: number;
    };
    pane(channelId: number, threadId?: number | null): ChatPane;
    fetchThread(threadId: number): Promise<ChatThread>;
    /** Abre o fio no lugar certo: o painel lateral da página cheia ou a gaveta. */
    openThread(channelId: number, threadId: number, messageId?: number): void;
    isFullPage(): boolean;
    upsertEverywhere(message: ChatMessage): void;
    /** Depois de enviar: a conversa conta como lida e a MD vai para o topo. */
    afterOwnMessage(message: ChatMessage): void;
    /** Atualiza o indicador "N respostas" da original de um fio. */
    refreshThreadOriginal(channelId: number, threadId: number): Promise<void>;
    saveDrawer(): void;
    navigate(route: ChatRoute): void;
    openDrawer(route?: ChatRoute): void;
    closeDrawer(): void;
    toggleExpand(): void;
    /** O ícone do cabeçalho: a página cheia para quem a prefere (e no celular), senão a gaveta. */
    toggleFromHeader(): void;
    /** "Abrir chat em tela cheia" a partir da gaveta, na mesma conversa. */
    openFullPage(): void;
    /** "Fechar chat em tela cheia": volta para o fórum, com a conversa na gaveta. */
    closeFullPage(route: ChatRoute): void;
    realtime(): boolean;
    attachRealtime(): void;
    private pollPanes;
    private expireTyping;
    /** Avisa que o leitor está digitando — no máximo a cada 4 s. */
    sendTyping(pane: ChatPane, typing: boolean): void;
    /** Uma mensagem nova de outra pessoa: contagens, som. */
    noteIncoming(message: ChatMessage, mentioned?: boolean): void;
    handle(event: ChatEvent): Promise<void>;
    private panesHave;
    /** Reage (ou tira a reação) já na tela, e confirma pela API. */
    react(message: ChatMessage, char: string, add?: boolean): Promise<void>;
}
/** O endereço da página cheia que corresponde a uma rota da gaveta. */
export declare function routeUrl(route: ChatRoute, store: ChatStore): string;
/** O singleton do chat no fórum. */
declare const chat: ChatStore;
export default chat;
