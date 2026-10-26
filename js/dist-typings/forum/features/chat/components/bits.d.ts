import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type { ChatChannel } from '../types';
/** Avatar com o cartão de usuário no clique. */
export declare function ChatUserAvatar(userId: number | null | undefined, options?: {
    interactive?: boolean;
    size?: string;
}): Mithril.Children;
export declare function cardFor(user: User, event: MouseEvent): void;
/** O ícone do canal: o emoji, o ícone da tag na cor dela, ou os avatares da MD. */
export declare function ChannelIcon(channel: ChatChannel): Mithril.Children;
export declare function ChannelName(channel: ChatChannel, unreadIndicator?: boolean): Mithril.Children;
export declare function ChannelTitle(channel: ChatChannel): Mithril.Children;
/** O ponto azul (há não lidas) ou o número verde (menções e MDs). */
export declare function UnreadIndicator(urgent: number, unread: boolean, className?: string): Mithril.Children;
export interface NavbarButton {
    key: string;
    icon: string;
    title: string;
    onclick: (e: MouseEvent) => void;
    className?: string;
    active?: boolean;
    indicator?: Mithril.Children;
}
/**
 * A barra de cima da gaveta e da página cheia (c-navbar): voltar, o título e
 * os botões. Na gaveta, clicar no fundo da barra recolhe/expande, como lá.
 */
export declare function Navbar(attrs: {
    title: Mithril.Children;
    back?: () => void;
    actions: NavbarButton[];
    onclick?: () => void;
    subTitle?: Mithril.Children;
}): Mithril.Children;
/** Os três botões da gaveta: recolher/expandir, tela cheia e fechar. */
export declare function drawerButtons(inDrawer: boolean): NavbarButton[];
export declare function userNames(ids: number[]): string;
export declare function isPhone(): boolean;
