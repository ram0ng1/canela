import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type DirectoryState from './DirectoryState';
export interface DirectoryControlsAttrs extends ComponentAttrs {
    state: DirectoryState;
}
/** Período, busca por nome e o total: a barra acima da tabela do diretório. */
export default class DirectoryControls extends Component<DirectoryControlsAttrs> {
    searchTimer: ReturnType<typeof setTimeout> | undefined;
    draft: string | null;
    onremove(vnode: Mithril.VnodeDOM<DirectoryControlsAttrs, this>): void;
    view(): Mithril.Children;
    /** A busca espera a pessoa parar de digitar: uma requisição por nome, não por tecla. */
    search(value: string): void;
}
