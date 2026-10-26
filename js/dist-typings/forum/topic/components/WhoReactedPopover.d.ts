import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export interface ReactorEntry {
    user: User;
    /** O ícone à direita: o coração vermelho ou o emoji da reação. */
    icon: Mithril.Children;
}
export declare function closeWhoReacted(): void;
/** Abre (ou fecha, num segundo clique na mesma contagem) a lista de quem reagiu. */
export declare function openWhoReacted(anchor: HTMLElement, load: () => Promise<ReactorEntry[]>): void;
/** O coração vermelho das curtidas (como o emoji ❤️). */
export declare function heartIcon(): Mithril.Children;
