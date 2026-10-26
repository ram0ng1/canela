import Modal from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import { type Shortcut } from '../shell/shortcuts';
/**
 * A janela de atalhos, aberta pela
 * tecla "?": o campo de busca no topo e, em duas colunas, uma caixa por grupo
 * com a descrição à esquerda e as teclas em pílulas à direita. O corpo rola
 * dentro do modal (80% da altura), em vez de empurrar a página.
 */
export default class KeyboardShortcutsModal extends Modal {
    filter: any;
    className(): string;
    title(): string;
    onready(): void;
    matches(shortcut: Shortcut, needle: string): boolean;
    content(): Mithril.Children;
}
