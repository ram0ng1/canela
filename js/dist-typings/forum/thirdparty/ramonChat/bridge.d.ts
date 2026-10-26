import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export declare const NAMESPACE = "ramon-chat";
/** O pedaço do modelo `chat-channels` do ramon/chat que a barra lateral lê. */
export interface RamonChannel {
    id(): string | undefined;
    displayName(): string;
    description(): string | null;
    isDirect(): boolean;
    isPrivate(): boolean;
    isMuted(): boolean;
    hasUnread(): boolean;
    unreadCount(): number;
    unreadMentionsCount(): number;
    others(): User[];
}
/** O pedaço do `ChatState` (o estado global do chat, `forum/state/chat`) que o tema usa. */
export interface RamonChatState {
    channels: RamonChannel[];
    channelsLoaded: boolean;
    channelsLoading: boolean;
    activeChannelId: number | null;
    drawerOpen: boolean;
    categoryChannels(): RamonChannel[];
    directChannels(): RamonChannel[];
    loadChannels(force?: boolean): Promise<unknown>;
    loadDrafts(): Promise<unknown>;
    setActiveChannel(id: number | null): void;
    rememberChannel(channel: RamonChannel): void;
    seedEmptyChannel(id: number): void;
    prefetchChannel(id: number): void;
    unreadSummary(): {
        channels: number;
        messages: number;
        mentions: number;
    };
}
/** Um módulo do ramon/chat já registrado, ou `null` (extensão desligada ou chunk ainda não baixado). */
export declare function ramonModule<T = any>(id: string): T | null;
/** O estado global do chat: o mesmo objeto que a página, a gaveta e o tempo real do ramon/chat usam. */
export declare function chatState(): RamonChatState | null;
/**
 * O leitor vê o chat: a mesma regra do `canUseChat()` do ramon/chat (que não
 * é exportada) — permissão no fórum, logado e sem ter desligado o chat nas
 * configurações.
 */
export declare function canUseChat(): boolean;
/** Estamos na página cheia do chat (o ChatPage do ramon/chat põe esta classe no <body>). */
export declare function onChatPage(): boolean;
/** O endereço de um canal, para o `href` (abrir em nova aba continua funcionando). */
export declare function channelUrl(id: number | string): string;
/**
 * Abre um canal: na gaveta, para quem a usa e não está na
 * página cheia; senão, na página do chat. No celular a barra lateral está
 * dentro do painel do hambúrguer — a navegação o fecha (o `Page` do core).
 */
export declare function openChannel(id: number): void;
/** Uma das telas do chat (`chat.threads`, `chat.search`, `chat.browse`…) na página cheia. */
export declare function openRoute(name: string): void;
/**
 * Abre (ou cria) a conversa direta com estas pessoas — o mesmo fluxo do
 * `startDirectMessage` do ramon/chat, que só aceita uma pessoa: aqui cabem
 * várias (a MD em grupo). O POST devolve o canal serializado.
 */
export declare function startDirect(userIds: number[]): Promise<boolean>;
/** O ícone do canal do próprio ramon/chat (emoji, imagem ou os avatares da MD). */
export declare function ramonChannelIcon(channel: RamonChannel, className: string): Mithril.Children;
/**
 * O "x" da MD na lista: sai da conversa pelo POST /leave do ramon/chat (o mesmo
 * da ação "Sair" dele) e a tira da lista. Devolve se saiu.
 */
export declare function leaveDirect(channel: RamonChannel): Promise<boolean>;
