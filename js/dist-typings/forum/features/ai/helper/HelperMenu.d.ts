import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type TextEditor from 'flarum/common/components/TextEditor';
import type ComposerState from 'flarum/forum/states/ComposerState';
import type Mithril from 'mithril';
export interface HelperMenuAttrs extends ComponentAttrs {
    editor: TextEditor;
    /** O clique no botão provisório (index.tsx) chegou antes do chunk: já nasce aberto. */
    initiallyOpen?: boolean;
}
type Panel = 'options' | 'titles' | 'tags';
interface Selection {
    start: number;
    end: number;
    text: string;
}
export default class HelperMenu extends Component<HelperMenuAttrs> {
    open: boolean;
    panel: Panel;
    customPrompt: string;
    loading: boolean;
    titles: string[];
    tagIds: string[];
    outsideListener: (event: Event) => void;
    keyListener: (event: KeyboardEvent) => void;
    /** A setinha do menu aberto e o menu para o qual ela foi feita. */
    arrow: {
        menu: HTMLElement;
        place: () => void;
        remove: () => void;
    } | null;
    composer(): ComposerState | null;
    oninit(vnode: Mithril.Vnode<HelperMenuAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>): void;
    dropArrow(): void;
    placeListener: () => void;
    /**
     * O menu fica fixo na janela, acima do botão e alinhado à direita dele. A
     * barra de formatação rola na horizontal (`overflow-x: auto`), e um menu
     * absoluto dentro dela era cortado: o clique abria um menu invisível.
     */
    place(): void;
    view(): JSX.Element;
    panelView(): Mithril.Children;
    options(): [string, string, string, string?][];
    suggestionsView(): Mithril.Children;
    emptySuggestions(): Mithril.Children;
    toggle(): void;
    /** O trecho selecionado, ou o texto todo quando nada está selecionado. */
    selection(): Selection;
    run(mode: string): void;
    applyTitle(title: string): void;
    toggleTag(tag: any): void;
    onOutside(event: Event): void;
    onKey(event: KeyboardEvent): void;
}
export {};
