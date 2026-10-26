import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type ChatPane } from '../ChatStore';
export interface ChatComposerAttrs extends ComponentAttrs {
    pane: ChatPane;
}
export default class ChatComposer extends Component<ChatComposerAttrs> {
    private focused;
    private suggestions;
    private suggestionIndex;
    private triggerStart;
    private suggestRequest;
    private unsubscribe;
    private fileInput;
    oncreate(vnode: Mithril.VnodeDOM<ChatComposerAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<ChatComposerAttrs, this>): void;
    view(): Mithril.Children;
    private textarea;
    /** O campo cresce até um quarto da tela (`max-height: 25dvh`). */
    private autosize;
    private dropdown;
    private pickFile;
    private onPaste;
    private onInput;
    private onKeyDown;
    private send;
    private insert;
    private cancelDetails;
    private messageDetails;
    private uploads;
    /** "Ana está digitando", "Ana e Bruno estão digitando", "Ana, Bruno e mais 3…". */
    private typingIndicator;
    private suggest;
    private choose;
    private closeSuggestions;
    private suggestionMenu;
}
