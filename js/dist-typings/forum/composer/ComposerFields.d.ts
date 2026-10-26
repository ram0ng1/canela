import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
import { type SelectKitRow } from './SelectKit';
import { type CanelaTag } from '../utils/tags';
import { type TagLimits } from './tagRules';
export interface ComposerFieldsAttrs extends ComponentAttrs {
    tags: CanelaTag[];
    onchange: (tags: CanelaTag[]) => void;
    disabled?: boolean;
    /** Editando as tags de uma discussão: vale o `canAddToDiscussion`. */
    discussion?: Discussion | null;
    /** Mostrar a metade da tag primária (padrão: sim). */
    categories?: boolean;
    /** Mostrar a metade das tags secundárias (padrão: sim, se houver alguma). */
    labels?: boolean;
}
export default class ComposerFields extends Component<ComposerFieldsAttrs> {
    view(): Mithril.Children;
    /** A seleção atual, sem repetidas e sem filhas órfãs. */
    selected(): CanelaTag[];
    /** Filha só com o pai escolhido (`requireParentTag`); as demais passam. */
    parentChosen(tag: CanelaTag, selected: CanelaTag[]): boolean;
    /** O aviso de máximo das primárias (só quando é possível mais de uma). */
    limitNote(count: number, max: number): Mithril.Children;
    categoryRows(filter: string, selected: CanelaTag[], selectable: CanelaTag[], limits: TagLimits): SelectKitRow[];
    labelRows(filter: string, selected: CanelaTag[], selectable: CanelaTag[], limits: TagLimits): SelectKitRow[];
    find(key: string, selectable: CanelaTag[]): CanelaTag | undefined;
    chooseCategory(key: string, selectable: CanelaTag[], limits: TagLimits): void;
    chooseLabel(key: string, selectable: CanelaTag[], limits: TagLimits): void;
    remove(tag: CanelaTag): void;
}
