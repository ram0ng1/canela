/*
 * A linha "tag primária | tags secundárias" do composer do Discourse
 * (`.title-and-category`): à esquerda o `category-chooser`, à direita o
 * `mini-tag-chooser`, dois select-kits na própria linha, no lugar do modal
 * do flarum/tags.
 *
 * As regras são as do TagDiscussionModal (ver `tagRules.ts`): só as tags que
 * o ator pode usar; à esquerda, as primárias de primeiro nível; à direita, as
 * tags filhas da primária escolhida (e só dela) e as secundárias, que juntas
 * contam para o máximo de secundárias, como no servidor. Trocar a primária
 * tira as filhas da anterior. Os máximos bloqueiam a adição; os mínimos são
 * cobrados ao publicar (`installComposerShell`). O resultado vai para
 * `composer.fields.tags`, como faz o addTagComposer do flarum/tags.
 *
 * Reaproveitável: quem tiver outro composer passa `tags`/`onchange` (e a
 * `discussion`, ao editar as tags de uma existente) e escolhe quais metades
 * mostrar.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from './SelectKit';
import { categorySymbol, type CanelaTag } from '../utils/tags';
import { t } from '../utils/settings';
import {
  addTag,
  canAddTag,
  countTags,
  isPrimaryParent,
  normalizeTags,
  parentTag,
  removeTag,
  selectableTags,
  sortSelectable,
  tagLimits,
  type TagLimits,
} from './tagRules';

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

function matches(tag: CanelaTag, filter: string): boolean {
  if (!filter) return true;

  const needle = filter.toLowerCase();
  const parent = parentTag(tag);

  return tag.name().toLowerCase().includes(needle) || (!!parent && parent.name().toLowerCase().includes(needle));
}

/** "(símbolo) Nome", o badge do Discourse, sem link. */
function badge(tag: CanelaTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);
  const parent = parentTag(tag);

  // A filha sem ícone: o quadradinho em duas cores, a do pai e a dela
  // (`.badge-category.--has-parent.--style-square`).
  if (parent && !tag.icon() && symbol?.attrs) {
    symbol.attrs.className = `${symbol.attrs.className || ''} CanelaCategorySymbol--split`;
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--cn-primary-medium)' };
  }

  return (
    <span className="CanelaChooserBadge">
      {symbol}
      <span className="CanelaChooserBadge-name">{tag.name()}</span>
    </span>
  );
}

/** Pai ▪ Filha, como `Suporte ▪ Instalação`. */
function categoryLabel(tag: CanelaTag): Mithril.Children {
  const parent = parentTag(tag);

  return parent ? [badge(parent), badge(tag)] : badge(tag);
}

export default class ComposerFields extends Component<ComposerFieldsAttrs> {
  view(): Mithril.Children {
    const { disabled, categories = true } = this.attrs;
    const limits = tagLimits();
    const selectable = selectableTags(this.attrs.discussion);
    const selected = this.selected();
    const chosenPrimary = selected.filter(isPrimaryParent);
    const chosenOthers = selected.filter((tag) => !isPrimaryParent(tag));
    const { secondary } = countTags(selected);

    // Uma metade só aparece se houver o que escolher nela (ou algo já escolhido).
    const showCategories = categories && (chosenPrimary.length > 0 || (limits.maxPrimary > 0 && selectable.some(isPrimaryParent)));
    const anyOthers = selectable.some((tag) => !isPrimaryParent(tag) && this.parentChosen(tag, selected));
    const showLabels = (this.attrs.labels ?? true) && (chosenOthers.length > 0 || (limits.maxSecondary > 0 && anyOthers));

    // Com mínimo de secundárias, o texto do flarum/tags ("Escolha mais 1 tag")
    // no lugar de "Tags opcionais…".
    const missing = limits.bypass ? 0 : Math.max(0, limits.minSecondary - secondary);
    const tagsPlaceholder = missing
      ? (app.translator.trans('flarum-tags.lib.tag_selection_modal.choose_secondary_placeholder', { count: missing }, true) as string)
      : t('composer.shell.tags_placeholder');

    return (
      <div className="CanelaComposerFields">
        {showCategories && (
          <SelectKit
            className={`CanelaComposerFields-cell CanelaComposerFields-category${chosenPrimary.length ? ' has-selection' : ''}`}
            label={t('composer.shell.category_placeholder')}
            disabled={disabled}
            filterIcon
            header={
              chosenPrimary.length ? (
                <span className="CanelaComposerFields-value">{chosenPrimary.map((tag, i) => [i > 0 ? ', ' : null, categoryLabel(tag)])}</span>
              ) : (
                <span className="CanelaComposerFields-placeholder">{t('composer.shell.category_placeholder')}</span>
              )
            }
            rows={(filter: string) => this.categoryRows(filter, selected, selectable, limits)}
            onselect={(key: string) => this.chooseCategory(key, selectable, limits)}
            after={() => this.limitNote(chosenPrimary.length, limits.maxPrimary)}
          />
        )}
        {showLabels && (
          <SelectKit
            className={`CanelaComposerFields-cell CanelaComposerFields-tags${chosenOthers.length ? ' has-selection' : ''}`}
            label={t('composer.shell.tags_placeholder')}
            disabled={disabled}
            caret="fas fa-plus"
            caretOpen="fas fa-plus"
            stayOpen
            header={
              <>
                <Icon name="fas fa-tag" className="CanelaComposerFields-tagIcon" />
                <span className="CanelaComposerFields-value">
                  {chosenOthers.length ? (
                    chosenOthers.map((tag) => tag.name()).join(', ')
                  ) : (
                    <span className="CanelaComposerFields-placeholder">{tagsPlaceholder}</span>
                  )}
                </span>
              </>
            }
            before={
              chosenOthers.length ? (
                <div className="CanelaSelectKit-selected">
                  {chosenOthers.map((tag) => (
                    <button
                      type="button"
                      className="CanelaSelectKit-chip"
                      title={t('composer.shell.remove_tag')}
                      onmousedown={(e: MouseEvent) => e.preventDefault()}
                      onclick={() => this.remove(tag)}
                    >
                      <span>{tag.name()}</span>
                      <Icon name="fas fa-xmark" />
                    </button>
                  ))}
                </div>
              ) : null
            }
            rows={(filter: string) => this.labelRows(filter, selected, selectable, limits)}
            onselect={(key: string) => this.chooseLabel(key, selectable, limits)}
            emptyText={
              secondary >= limits.maxSecondary ? t('composer.shell.max_secondary_tags', { count: limits.maxSecondary }) : t('composer.shell.no_tags')
            }
          />
        )}
      </div>
    );
  }

  /** A seleção atual, sem repetidas e sem filhas órfãs. */
  selected(): CanelaTag[] {
    return normalizeTags(this.attrs.tags.filter(Boolean));
  }

  /** Filha só com o pai escolhido (`requireParentTag`); as demais passam. */
  parentChosen(tag: CanelaTag, selected: CanelaTag[]): boolean {
    const parent = parentTag(tag);
    return !parent || selected.includes(parent);
  }

  /** O aviso de máximo das primárias (só quando é possível mais de uma). */
  limitNote(count: number, max: number): Mithril.Children {
    if (max <= 1 || count < max) return null;

    return <div className="CanelaSelectKit-note">{t('composer.shell.max_primary_tags', { count: max })}</div>;
  }

  categoryRows(filter: string, selected: CanelaTag[], selectable: CanelaTag[], limits: TagLimits): SelectKitRow[] {
    const chosen = selected.filter(isPrimaryParent);
    let options = sortSelectable(selectable.filter(isPrimaryParent));

    // Podendo várias primárias, no máximo só as escolhidas ficam (para tirar),
    // como no modal do flarum/tags. Com uma só, escolher outra troca.
    if (limits.maxPrimary > 1 && chosen.length >= limits.maxPrimary) {
      options = options.filter((tag) => selected.includes(tag));
    }

    const rows: SelectKitRow[] = options
      .filter((tag) => matches(tag, filter))
      .map((tag) => ({
        key: String(tag.id()),
        selected: selected.includes(tag),
        title: tag.name(),
        content: (
          <div className="CanelaCategoryRow">
            <div className="CanelaCategoryRow-status">
              {categoryLabel(tag)}
              <span className="CanelaCategoryRow-count">× {tag.discussionCount() || 0}</span>
            </div>
            {tag.description() ? <div className="CanelaCategoryRow-desc">{tag.description()}</div> : null}
          </div>
        ),
      }));

    // Sem primária obrigatória (ou podendo ignorar o mínimo), dá para voltar a "nenhuma".
    if (!filter && (limits.minPrimary === 0 || limits.bypass) && chosen.length) {
      rows.unshift({
        key: 'none',
        content: <div className="CanelaCategoryRow CanelaCategoryRow--none">{t('composer.shell.no_category')}</div>,
      });
    }

    return rows;
  }

  labelRows(filter: string, selected: CanelaTag[], selectable: CanelaTag[], limits: TagLimits): SelectKitRow[] {
    // No máximo de secundárias (filhas inclusas), a lista fica vazia e o
    // texto de vazio avisa o limite.
    if (countTags(selected).secondary >= limits.maxSecondary) return [];

    // `sortTags` do flarum/tags: as filhas (que têm posição) primeiro, na
    // ordem da tag pai; depois as secundárias, as mais usadas primeiro.
    const options = selectable.filter(
      (tag) => !isPrimaryParent(tag) && !selected.includes(tag) && this.parentChosen(tag, selected) && matches(tag, filter)
    );

    return sortSelectable(options).map((tag) => {
      const child = !!parentTag(tag);

      return {
        key: String(tag.id()),
        title: tag.name(),
        content: (
          <span className={`CanelaTagRow${child ? ' CanelaTagRow--child' : ''}`}>
            <span className="CanelaTagRow-name">{child ? categoryLabel(tag) : tag.name()}</span>
            <span className="CanelaTagRow-count">x{tag.discussionCount() || 0}</span>
          </span>
        ),
      };
    });
  }

  find(key: string, selectable: CanelaTag[]): CanelaTag | undefined {
    return selectable.find((tag) => String(tag.id()) === key);
  }

  chooseCategory(key: string, selectable: CanelaTag[], limits: TagLimits): void {
    const selected = this.selected();

    // "Nenhuma": saem as primárias e, com elas, as filhas.
    if (key === 'none') {
      this.attrs.onchange(normalizeTags(selected.filter((tag) => !isPrimaryParent(tag))));
      return;
    }

    const tag = this.find(key, selectable);
    if (!tag) return;

    if (selected.includes(tag)) {
      // Com várias primárias, escolher de novo tira; com uma, nada muda.
      if (limits.maxPrimary > 1) this.attrs.onchange(removeTag(selected, tag));
      return;
    }

    if (canAddTag(tag, selected, selectable, limits)) {
      this.attrs.onchange(selected.concat(tag));
      return;
    }

    // No máximo: troca. As filhas da primária que saiu deixam de valer.
    const base = normalizeTags(selected.filter((item) => !isPrimaryParent(item)));
    const next = addTag(base, tag, selectable, limits);

    if (next) this.attrs.onchange(next);
  }

  chooseLabel(key: string, selectable: CanelaTag[], limits: TagLimits): void {
    const tag = this.find(key, selectable);
    if (!tag) return;

    const next = addTag(this.selected(), tag, selectable, limits);
    if (next) this.attrs.onchange(next);
  }

  remove(tag: CanelaTag): void {
    this.attrs.onchange(removeTag(this.selected(), tag));
  }
}
