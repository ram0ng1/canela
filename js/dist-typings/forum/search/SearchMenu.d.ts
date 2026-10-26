import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface SearchMenuAttrs extends ComponentAttrs {
    /** `header` (o campo do cabeçalho) ou `welcome` (o banner de boas-vindas). */
    location: 'header' | 'welcome';
}
export declare function aiAvailable(): boolean;
export default class SearchMenu extends Component<SearchMenuAttrs> {
    protected open: boolean;
    protected lastEnter: number;
    protected inputId: string;
    protected onDocumentPress: (event: Event) => void;
    oninit(vnode: Mithril.Vnode<SearchMenuAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>): void;
    view(): Mithril.Children;
    placeholder(): string;
    inputView(): Mithril.Children;
    input(): HTMLInputElement | null;
    openMenu(): void;
    /** O toque na lupa do celular: o campo precisa existir na tela antes do foco (o teclado só abre dentro do gesto). */
    openAndFocus(): void;
    close(blur?: boolean): void;
    go(url: string): void;
    fullSearch(): void;
    onInputKeydown(event: KeyboardEvent): void;
    /** Esc fecha; as setas andam pelos links do painel e voltam ao campo. */
    onKeydown(event: KeyboardEvent): void;
}
