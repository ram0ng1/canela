import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import { type DiffPart } from './diff';
export interface HistoryModalAttrs extends IInternalModalAttrs {
    post: Post;
}
export interface VersionUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}
export interface Version {
    number: number;
    createdAt: string | null;
    user: VersionUser | null;
    content: string | null;
}
export interface VersionList {
    versions: Version[];
    contentHidden: boolean;
}
type ViewMode = 'inline' | 'side';
export default class HistoryModal<A extends IInternalModalAttrs = HistoryModalAttrs> extends Modal<A> {
    versions: Version[];
    contentHidden: boolean;
    /** A versão mostrada (índice em `versions`); a comparação é com a anterior. */
    index: number;
    mode: ViewMode;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<A, this>): void;
    /**
     * As versões da mais antiga para a mais nova. Separado do oninit para que
     * outro histórico (o das revisões da wiki) use o mesmo modal com os dados
     * dele.
     */
    load(): Promise<VersionList>;
    className(): string;
    title(): Mithril.Children;
    content(): Mithril.Children;
    navigation(): Mithril.Children;
    comparison(): Mithril.Children;
    /** Só as partes dos tipos pedidos; <ins>/<del> dão o sentido também ao leitor de tela. */
    render(parts: DiffPart[], kinds: DiffPart['kind'][]): Mithril.Children;
    setMode(mode: ViewMode): void;
}
export {};
