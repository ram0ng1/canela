import type TextEditor from 'flarum/common/components/TextEditor';
import type Mithril from 'mithril';
export interface Suggestion {
    key: string;
    /** O que aparece na linha do menu. */
    label: Mithril.Children;
    /** O texto que substitui o gatilho e o que foi digitado. */
    replacement: string;
}
export interface AutocompleteOptions {
    /** Classe extra do menu, para o CSS de cada gatilho. */
    className: string;
    trigger: string;
    /** Caracteres aceitos depois do gatilho (o resto encerra a sugestão). */
    validBit: RegExp;
    /** Quantos caracteres antes do cursor procurar o gatilho. */
    lookBehind?: number;
    /** Texto do cabeçalho do menu, quando há. */
    header?: () => string;
    /** As sugestões para o que foi digitado; pode ser assíncrono. */
    suggest: (typed: string) => Suggestion[] | Promise<Suggestion[]>;
}
export default class Autocomplete {
    private readonly editor;
    private readonly options;
    active: boolean;
    private index;
    private items;
    private start;
    private container;
    private textarea;
    private request;
    constructor(editor: TextEditor, options: AutocompleteOptions);
    /** Chamado no `onbuild` do editor: o textarea já está no DOM. */
    attach(): void;
    /** O ouvinte de digitação, posto em `params.inputListeners`. */
    readonly listener: () => void;
    private show;
    hide(): void;
    private move;
    private choose;
    private render;
}
