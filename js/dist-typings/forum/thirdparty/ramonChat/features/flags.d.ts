export type RamonChatFeature = 'preferences' | 'header_indicator' | 'quick_reactions' | 'drawer_shortcut' | 'bell' | 'new_message' | 'group_name' | 'self_dm' | 'dm_guard' | 'starred' | 'tag_cleanup' | 'auto_join' | 'permalink' | 'restore' | 'paste_upload' | 'long_press' | 'collapse_deleted' | 'pin_indicator' | 'pin_bar' | 'retention' | 'delete_confirm' | 'typing_poll' | 'mention_warning' | 'review_flags';
interface RamonChatAttrs {
    features: Partial<Record<RamonChatFeature, boolean>>;
    dmMax: number;
    retentionDays: number;
    dmRetentionDays: number;
}
export declare function attrs(): RamonChatAttrs | null;
/** O recurso está ligado no admin (e o leitor pode usar o chat). */
export declare function feature(name: RamonChatFeature): boolean;
/** A aba Chat das preferências mostra a seção do ramon/chat (user/preferences/tabs.ts). */
export declare function ramonChatPreferencesOn(): boolean;
/**
 * As denúncias do chat entram na fila "Revisar" do tema (review/, o menu do
 * usuário e a barra lateral). Para quem vê as sinalizações dos posts
 * (`discussion.viewFlags`, o `canViewFlags` do flarum/flags) ou modera o chat
 * (`ramon-chat.moderate`, o `canModerateChat`).
 *
 * Hoje o endpoint `chat-message-flags` do ramon/chat só aceita a segunda; a
 * fila pede em silêncio e, recusada, fica só com os posts — quando ele passar
 * a aceitar `discussion.viewFlags`, as denúncias aparecem sem mudar nada aqui.
 */
export declare function chatReviewOn(): boolean;
/**
 * O ramon/chat já soma as denúncias do chat na contagem do flarum/flags
 * (`flagCount` / `newFlagCount`)? Hoje não: a contagem dele é o
 * `chatOpenFlagsCount`, à parte. Quando passar a somar, ele deve avisar com o
 * atributo do fórum `chatFlagsInFlagCount: true` — com ele, o tema para de
 * somar o `chatOpenFlagsCount` por cima, e nada é contado duas vezes.
 */
export declare function chatCountedByFlags(): boolean;
/** Quantas denúncias do chat somar aos contadores de revisão (0 se já vêm na do flarum/flags). */
export declare function chatReviewCount(): number;
export declare function dmMax(): number;
export declare function apiUrl(path: string): string;
/** Uma preferência do leitor, com o padrão quando não há valor. */
export declare function pref<T>(key: string, fallback: T): T;
/** Tradução dos recursos (`ramon-canela.forum.ramon_chat.*`). */
export declare function rt(key: string, params?: Record<string, unknown>): string;
/** As traduções do chat próprio do tema (`ramon-canela.forum.chat.*`), reaproveitadas. */
export declare function ct(key: string, params?: Record<string, unknown>): string;
/** Um módulo do ramon/chat pelo registro (nunca `import`: sem a extensão, o tema quebraria). */
export declare function ramonModule<T = any>(id: string): T | null;
/** O estado global do chat (`forum/state/chat`). */
export declare function chatState(): any;
/** O caminho de um componente do ramon/chat para `extend()`/`override()` (também os do chunk `chatUi`). */
export declare function component(name: string): any;
export declare function isPhone(): boolean;
/** Mithril: numa lista, ou todos têm `key` ou nenhum — a chave só vai se os irmãos já tiverem. */
export declare function pushChild(children: any[], child: any, key: string, index?: number): void;
/** Acha o primeiro vnode com esta classe na árvore. */
export declare function findByClass(node: any, className: string): any;
/** Os filhos de um vnode como lista editável (o JSX com um array só deixa o array direto). */
export declare function childList(vnode: any): any[];
export declare function copyText(text: string): Promise<void>;
export declare function readLocal<T>(key: string, fallback: T): T;
export declare function writeLocal(key: string, value: unknown): void;
export {};
