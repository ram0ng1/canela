import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export interface CommunityEntry {
    key: string;
    label: string;
    icon?: string;
}
export interface CommunityCustomizeModalAttrs extends IInternalModalAttrs {
    /** Os itens da seção, na ordem em que aparecem agora. */
    entries: CommunityEntry[];
    onsave?: () => void;
}
/**
 * Quais itens da seção principal da barra lateral ficam à vista (os
 * desmarcados vão para dentro do "Mais") e em que ordem: cada linha se
 * arrasta pela alça (⋮⋮), com o mouse ou o dedo — Pointer Events, porque o
 * arrastar nativo do HTML não funciona no toque do iOS. Com o foco na alça,
 * as setas do teclado fazem o mesmo. As linhas têm `key`: o elemento
 * arrastado (e o foco) acompanha o item.
 */
export default class CommunityCustomizeModal extends Modal<CommunityCustomizeModalAttrs> {
    hidden: Set<string>;
    order: string[];
    dragging: string | null;
    oninit(vnode: Mithril.Vnode<CommunityCustomizeModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): Mithril.Children;
    toggle(key: string): void;
    /** Põe o item na posição `index` e faz os vizinhos deslizarem até o lugar novo. */
    moveTo(key: string, index: number): void;
    /**
     * Arrastar pela alça. A linha muda de lugar assim que o ponteiro passa da
     * metade da vizinha. Os eventos são ouvidos na janela (do mesmo ponteiro):
     * mudar a linha de lugar no DOM solta a captura do ponteiro, e a alça
     * deixaria de recebê-los no meio do arraste.
     */
    startDrag(event: PointerEvent, key: string): void;
    /** O teclado na alça: ↑ e ↓ sobem e descem o item; Home e End o levam às pontas. */
    keyMove(event: KeyboardEvent, key: string): void;
    save(): void;
    reset(): void;
}
