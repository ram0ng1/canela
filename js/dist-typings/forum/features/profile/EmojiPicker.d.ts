import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface EmojiPickerAttrs extends ComponentAttrs {
    value: string;
    onchange: (emoji: string) => void;
}
export default class EmojiPicker extends Component<EmojiPickerAttrs> {
    open: boolean;
    outsideHandler?: (event: Event) => void;
    view(): JSX.Element;
    toggle(): void;
    choose(emoji: string, close?: boolean): void;
    oncreate(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>): void;
}
