/*
 * As regras de escolha de tags do flarum/tags, para os seletores próprios do
 * tema (a linha "tag primária | tags secundárias" do composer, as sugestões
 * da IA, o tópico vinculado). São as mesmas do TagDiscussionModal e da
 * validação do servidor (`DiscussionResourceFields`):
 *
 * - só entram as tags de `getSelectableTags`: as que o ator pode usar para
 *   iniciar discussão ou, editando uma discussão, as que pode adicionar a ela
 *   (mais as que ela já tem);
 * - uma tag filha só vale com a tag pai escolhida (`requireParentTag`); sem o
 *   pai, as filhas dele saem junto;
 * - "primária" é a primária de primeiro nível (`isPrimaryParent`); as filhas
 *   contam como secundárias, como o servidor conta;
 * - mínimos e máximos de `flarum-tags.*` (`minPrimaryTags` etc.), com a
 *   permissão "ignorar requisitos de tags" (`canBypassTagCounts`) dispensando
 *   os mínimos, como o modal do core permite publicar sem eles.
 *
 * Sempre que o flarum/tags expõe a função (`getSelectableTags`, `sortTags`),
 * ela é usada no lugar da cópia daqui, para seguir o comportamento dele.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

import { allTags, isTagsEnabled, sortTags as themeSortTags, type CanelaTag } from '../utils/tags';

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

/** Os padrões da migration do flarum/tags, para quando o atributo falta. */
const DEFAULTS = { minPrimaryTags: 1, maxPrimaryTags: 1, minSecondaryTags: 0, maxSecondaryTags: 3 };

function setting(name: keyof typeof DEFAULTS): number {
  const value = parseInt(String(app.forum.attribute(name) ?? ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS[name];
}

export function tagLimits(): TagLimits {
  return {
    minPrimary: setting('minPrimaryTags'),
    maxPrimary: setting('maxPrimaryTags'),
    minSecondary: setting('minSecondaryTags'),
    maxSecondary: setting('maxSecondaryTags'),
    bypass: !!app.forum.attribute('canBypassTagCounts'),
  };
}

/** O pai de uma filha (pelo atributo `isChild`, que vem sempre). */
export function parentTag(tag: CanelaTag): CanelaTag | null {
  if (!tag.isChild()) return null;

  const parent = tag.parent();
  return parent ? parent : null;
}

/** Primária de primeiro nível: a única que conta como "primária" no servidor. */
export function isPrimaryParent(tag: CanelaTag): boolean {
  return tag.position() !== null && tag.position() !== undefined && !tag.isChild();
}

/** Secundária "de verdade" (sem posição): a que fica no seletor da direita. */
export function isSecondaryTag(tag: CanelaTag): boolean {
  return tag.position() === null || tag.position() === undefined;
}

function flarumTags(path: string): any {
  try {
    return isTagsEnabled() ? flarum.reg.get('flarum-tags', path) : null;
  } catch {
    return null;
  }
}

/** `getSelectableTags` do flarum/tags (com cópia de reserva). */
export function selectableTags(discussion?: Discussion | null): RuleTag[] {
  if (!isTagsEnabled()) return [];

  const own = flarumTags('forum/utils/getSelectableTags');
  if (typeof own === 'function') return own(discussion || undefined) as RuleTag[];

  const tags = allTags() as RuleTag[];

  if (discussion) {
    const current = (discussion.tags?.() || []) as RuleTag[];
    return tags.filter((tag) => tag.canAddToDiscussion?.() || current.includes(tag));
  }

  return tags.filter((tag) => !!tag.canStartDiscussion?.());
}

/** A ordem do TagSelectionModal (`sortTags` do flarum/tags). */
export function sortSelectable<T extends CanelaTag>(tags: T[]): T[] {
  const own = flarumTags('common/utils/sortTags');
  return (typeof own === 'function' ? own(tags) : themeSortTags(tags)) as T[];
}

export function countTags(selected: CanelaTag[]): { primary: number; secondary: number } {
  const primary = selected.filter(isPrimaryParent).length;
  return { primary, secondary: selected.length - primary };
}

/**
 * Tira o que o flarum/tags não aceitaria na seleção: repetidas, filhas cujo
 * pai saiu e, se `allowed` vier, as tags fora dele.
 */
export function normalizeTags<T extends CanelaTag>(selected: T[], allowed?: CanelaTag[]): T[] {
  const result: T[] = [];

  for (const tag of selected) {
    if (!tag || result.includes(tag)) continue;
    if (allowed && !allowed.includes(tag)) continue;
    result.push(tag);
  }

  return result.filter((tag) => {
    const parent = parentTag(tag);
    return !parent || result.includes(parent as T);
  });
}

/** Tira a tag e, como o modal do core, as filhas dela. */
export function removeTag<T extends CanelaTag>(selected: T[], tag: T): T[] {
  return selected.filter((item) => item !== tag && parentTag(item) !== tag);
}

/** Se ainda cabe mais uma tag desse tipo (os máximos valem para todos). */
export function hasRoomFor(tag: CanelaTag, selected: CanelaTag[], limits = tagLimits()): boolean {
  const { primary, secondary } = countTags(selected);

  return isPrimaryParent(tag) ? primary < limits.maxPrimary : secondary < limits.maxSecondary;
}

/**
 * Se a tag pode entrar agora: está entre as selecionáveis, o pai dela (se
 * for filha) já foi escolhido e o máximo do tipo dela não foi atingido.
 */
export function canAddTag(tag: CanelaTag, selected: CanelaTag[], selectable: CanelaTag[] = selectableTags(), limits = tagLimits()): boolean {
  if (selected.includes(tag) || !selectable.includes(tag)) return false;

  const parent = parentTag(tag);
  if (parent && !selected.includes(parent)) return false;

  return hasRoomFor(tag, selected, limits);
}

/**
 * Acrescenta a tag respeitando as regras. Uma filha sugerida sem o pai leva o
 * pai junto (como o `addTag` do modal), se o pai couber. Devolve `null`
 * quando não dá para acrescentar.
 */
export function addTag<T extends CanelaTag>(selected: T[], tag: T, selectable: CanelaTag[] = selectableTags(), limits = tagLimits()): T[] | null {
  const parent = parentTag(tag) as T | null;
  let base = selected;

  if (parent && !base.includes(parent)) {
    if (!canAddTag(parent, base, selectable, limits)) return null;
    base = base.concat(parent);
  }

  return canAddTag(tag, base, selectable, limits) ? base.concat(tag) : null;
}

/**
 * O que falta para publicar, com o texto do próprio flarum/tags; `null`
 * quando a seleção atende aos mínimos (ou o ator pode ignorá-los).
 */
export function missingTagsMessage(selected: CanelaTag[], limits = tagLimits()): { kind: 'primary' | 'secondary'; message: string } | null {
  if (limits.bypass) return null;

  const { primary, secondary } = countTags(selected);

  if (primary < limits.minPrimary) {
    return {
      kind: 'primary',
      message: app.translator.trans(
        'flarum-tags.lib.tag_selection_modal.choose_primary_placeholder',
        { count: limits.minPrimary - primary },
        true
      ) as string,
    };
  }

  if (secondary < limits.minSecondary) {
    return {
      kind: 'secondary',
      message: app.translator.trans(
        'flarum-tags.lib.tag_selection_modal.choose_secondary_placeholder',
        { count: limits.minSecondary - secondary },
        true
      ) as string,
    };
  }

  return null;
}
