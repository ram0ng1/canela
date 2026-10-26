import type Discussion from 'flarum/common/models/Discussion';
import { type CanelaTag } from '../utils/tags';
export type RuleTag = CanelaTag & {
    canStartDiscussion?: () => boolean;
    canAddToDiscussion?: () => boolean;
};
export interface TagLimits {
    minPrimary: number;
    maxPrimary: number;
    minSecondary: number;
    maxSecondary: number;
    /** "Ignorar requisitos de tags": dispensa os mínimos. */
    bypass: boolean;
}
export declare function tagLimits(): TagLimits;
/** O pai de uma filha (pelo atributo `isChild`, que vem sempre). */
export declare function parentTag(tag: CanelaTag): CanelaTag | null;
/** Primária de primeiro nível: a única que conta como "primária" no servidor. */
export declare function isPrimaryParent(tag: CanelaTag): boolean;
/** Secundária "de verdade" (sem posição): a que fica no seletor da direita. */
export declare function isSecondaryTag(tag: CanelaTag): boolean;
/** `getSelectableTags` do flarum/tags (com cópia de reserva). */
export declare function selectableTags(discussion?: Discussion | null): RuleTag[];
/** A ordem do TagSelectionModal (`sortTags` do flarum/tags). */
export declare function sortSelectable<T extends CanelaTag>(tags: T[]): T[];
export declare function countTags(selected: CanelaTag[]): {
    primary: number;
    secondary: number;
};
/**
 * Tira o que o flarum/tags não aceitaria na seleção: repetidas, filhas cujo
 * pai saiu e, se `allowed` vier, as tags fora dele.
 */
export declare function normalizeTags<T extends CanelaTag>(selected: T[], allowed?: CanelaTag[]): T[];
/** Tira a tag e, como o modal do core, as filhas dela. */
export declare function removeTag<T extends CanelaTag>(selected: T[], tag: T): T[];
/** Se ainda cabe mais uma tag desse tipo (os máximos valem para todos). */
export declare function hasRoomFor(tag: CanelaTag, selected: CanelaTag[], limits?: TagLimits): boolean;
/**
 * Se a tag pode entrar agora: está entre as selecionáveis, o pai dela (se
 * for filha) já foi escolhido e o máximo do tipo dela não foi atingido.
 */
export declare function canAddTag(tag: CanelaTag, selected: CanelaTag[], selectable?: CanelaTag[], limits?: TagLimits): boolean;
/**
 * Acrescenta a tag respeitando as regras. Uma filha sugerida sem o pai leva o
 * pai junto (como o `addTag` do modal), se o pai couber. Devolve `null`
 * quando não dá para acrescentar.
 */
export declare function addTag<T extends CanelaTag>(selected: T[], tag: T, selectable?: CanelaTag[], limits?: TagLimits): T[] | null;
/**
 * O que falta para publicar, com o texto do próprio flarum/tags; `null`
 * quando a seleção atende aos mínimos (ou o ator pode ignorá-los).
 */
export declare function missingTagsMessage(selected: CanelaTag[], limits?: TagLimits): {
    kind: 'primary' | 'secondary';
    message: string;
} | null;
