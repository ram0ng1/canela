import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type SearchMenu from './SearchMenu';
type Panel = typeof import('./SearchPanel');
/** `idle`: espera o navegador ficar ocioso (fora da primeira pintura); senão, já. */
export declare function preloadSearchPanel(opts?: {
    idle?: boolean;
} | Event): void;
/** Roda já se o chunk chegou (sem perder o redesenho do evento); senão, quando chegar. */
export declare function withSearchPanel(run: (panel: Panel) => void): void;
export interface SearchPanelSlotAttrs extends ComponentAttrs {
    menu: SearchMenu;
}
/** O painel, se o chunk já chegou; senão nada até ele chegar (normalmente já chegou). */
export declare class SearchPanelSlot extends Component<SearchPanelSlotAttrs> {
    oninit(vnode: Mithril.Vnode<SearchPanelSlotAttrs, this>): void;
    view(): Mithril.Children;
}
export {};
