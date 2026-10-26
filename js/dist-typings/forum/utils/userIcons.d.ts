import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
/** Onde o nome aparece: muda o tamanho e se cabe um popover. */
export type UserIconContext = 'post' | 'embedded' | 'replyTo' | 'card' | 'profile' | 'directory' | 'mention' | 'menu' | 'list';
type Provider = (user: User, context: UserIconContext) => Mithril.Children;
/** Registra um ícone; prioridade maior vem primeiro, como no ItemList. */
export declare function registerUserIcon(key: string, provider: Provider, priority?: number): void;
/**
 * Os ícones da pessoa num <span> só (ou nada): um vnode único não mexe nas
 * listas com key do Mithril de quem chama.
 */
export declare function userIcons(user: User | null | undefined, context: UserIconContext): Mithril.Children;
export {};
