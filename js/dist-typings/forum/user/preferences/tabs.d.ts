import type User from 'flarum/common/models/User';
export type PrefTab = 'account' | 'security' | 'profile' | 'notifications' | 'tracking' | 'users' | 'interface' | 'navigation-menu' | 'chat' | 'other';
export declare const TAB_ROUTE = "user.preferences.tab";
export declare const BASE_ROUTE = "user.preferences";
/** Ícones das abas, os mesmos da navegação secundária do perfil. */
export declare const TAB_ICONS: Record<PrefTab, string>;
/** Itens do `notificationsItems` que vão para o "Acompanhamento". */
export declare const TRACKING_ITEMS: string[];
export declare function sectionTab(key: string): PrefTab;
export declare function rememberOther(value: boolean): void;
/** As abas que este usuário tem, na ordem do tema. */
export declare function visibleTabs(user: User): PrefTab[];
export declare function tabUrl(user: User, tab: PrefTab): string;
/** A aba aberta agora, ou null fora das preferências. */
export declare function currentTab(): PrefTab | null;
