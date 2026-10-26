import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export type LobbyTab = 'channels' | 'dms';
export declare function rememberContinue(id: number | null): void;
export interface ChatLobbyAttrs extends ComponentAttrs {
    tab: LobbyTab;
}
export default class ChatLobby extends Component<ChatLobbyAttrs> {
    oninit(vnode: Mithril.Vnode<ChatLobbyAttrs, this>): void;
    view(): Mithril.Children;
    private channelsTab;
    private directTab;
    /** "Continuar em #canal": a última conversa, no topo, sem abrir sozinha. */
    private continueRow;
}
/** As abas do topo, no computador (Salvos e Denúncias só para quem modera). */
export declare class LobbyTabs extends Component<{
    current: string;
}> {
    view(): Mithril.Children;
}
