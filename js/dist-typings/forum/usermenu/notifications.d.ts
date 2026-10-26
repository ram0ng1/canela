import type Notification from 'flarum/common/models/Notification';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
/** As abas que filtram notificações: "Respostas" junta mencionado, citado, respondido e postado. */
export declare const REPLY_TYPES: string[];
/** `postReacted` é o tipo das reações (fof/reactions), que também vão para Curtidas. */
export declare const LIKE_TYPES: string[];
export declare const MESSAGE_TYPES: string[];
export declare const BOOKMARK_TYPES: string[];
export declare const CHAT_TYPES: string[];
/** As do ramon/chat (thirdparty/ramonChat), quando ele toma o lugar do chat do tema: menções, convites, moderação e posse do canal. */
export declare const RAMON_CHAT_TYPES: string[];
export interface NotificationFilter {
    /** Só estes tipos; sem a lista, todos. */
    types?: string[] | null;
    /** Todos menos estes (a aba "Outras notificações"). */
    exclude?: string[] | null;
}
/** Tudo o que o `app.notifications` já carregou, na ordem da API (mais novas primeiro). */
export declare function loadedNotifications(): Notification[];
export declare function matches(notification: Notification, filter: NotificationFilter): boolean;
export declare function filteredNotifications(filter: NotificationFilter): Notification[];
/** O número da bolha de uma aba: as não lidas daquele grupo entre as carregadas. */
export declare function unreadCount(filter: NotificationFilter): number;
/** Como o `Notification.markAsRead()` do core, para itens que não são o componente dele. */
export declare function markNotificationRead(notification: Notification): Promise<unknown>;
/**
 * "Descartar": sem filtro, o POST /notifications/read do core (todas). Com
 * filtro, só as não lidas daquele grupo, uma a uma — o Flarum não descarta
 * por tipo.
 */
export declare function dismissNotifications(filter: NotificationFilter | null): Promise<unknown>;
export interface NotificationView {
    icon: string;
    href: string;
    label: Mithril.Children;
    description: Mithril.Children;
    title: string;
}
/**
 * O que uma notificação mostra: quem gerou (em negrito) e o título do
 * tópico, com o tipo só no ícone.
 * Sem tópico ou sem outra pessoa (um emblema ganho, uma suspensão), o texto
 * do próprio componente vira a descrição, sem rótulo — como "Ganhou
 * 'Primeira curtida'". A frase inteira fica no `title`.
 */
export declare function describeNotification(notification: Notification): NotificationView | null;
/** O `.icon-avatar`: avatar de 2em com o ícone do tipo num selo redondo no canto. */
export declare function IconAvatar(user: User | null | false | undefined, icon: string, system?: boolean): Mithril.Children;
export interface MenuItemAttrs {
    className?: string;
    unread?: boolean;
    href: string;
    title?: string;
    avatar: Mithril.Children;
    label?: Mithril.Children;
    description?: Mithril.Children;
    onclick?: (e: MouseEvent) => void;
}
/** O `<li>` do `menu-item`. Fecha o menu ao seguir o link. */
export declare function MenuItem(attrs: MenuItemAttrs): Mithril.Children;
export declare function NotificationItem(notification: Notification): Mithril.Children;
