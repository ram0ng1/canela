import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface EmojiPickerAttrs extends ComponentAttrs {
    onselect: (emoji: string) => void;
    onclose: () => void;
}
export default class EmojiPicker extends Component<EmojiPickerAttrs> {
    private groups;
    private byChar;
    private query;
    private activeGroup;
    private tone;
    private toneOpen;
    private hovered;
    private twemoji;
    oninit(vnode: Mithril.Vnode<EmojiPickerAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>): void;
    view(): JSX.Element;
    private groupButtons;
    private content;
    private section;
    private grid;
    private emojiImage;
    private toneSelector;
    private select;
    /** Enter na busca insere o primeiro resultado. */
    private onSearchKey;
    private scrollTo;
    /** A categoria em destaque acompanha a rolagem da grade. */
    private trackScroll;
}
export declare function closeEmojiPicker(): void;
/**
 * Abre o seletor preso a `anchor` (o botão da barra). Fica acima do botão
 * quando há espaço — o editor está embaixo da tela — e nunca sai pela
 * lateral. No celular o CSS o transforma numa folha presa ao rodapé.
 */
export declare function openEmojiPicker(anchor: HTMLElement, onselect: (emoji: string) => void): void;
