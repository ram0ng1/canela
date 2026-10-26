import type Mithril from 'mithril';
import type { RamonChannel } from './bridge';
export interface RamonChatSidebarHooks {
    newMessage?: () => void;
    sortChannels?: (channels: RamonChannel[], section: 'channels' | 'direct') => RamonChannel[];
    channelSuffix?: (channel: RamonChannel) => Mithril.Children;
}
export declare const sidebarHooks: RamonChatSidebarHooks;
/** Registra (ou troca) ganchos da barra lateral. */
export declare function registerSidebarHooks(hooks: RamonChatSidebarHooks): void;
/** Aplica um gancho sem deixar um erro dele derrubar a barra lateral inteira. */
export declare function safely<T>(fn: () => T, fallback: T): T;
