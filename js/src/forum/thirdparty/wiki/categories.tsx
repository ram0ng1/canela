/*
 * As categorias da wiki (modelo próprio, com nome, cor, ícone e contagem):
 * a lista do store, o símbolo e o badge do tema, e o `category-chooser` do
 * composer. Usadas pelas telas (./pages) e pelo composer do artigo
 * (./composer).
 */
import app from 'flarum/forum/app';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from '../../composer/SelectKit';
import { categorySymbol, type CanelaTag } from '../../utils/tags';
import { t } from '../../utils/settings';
import { wikiIndexUrl, wt } from './shared';

// ---------------------------------------------------------------------
// Categorias da wiki (modelo próprio, com nome, cor, ícone e contagem)
// ---------------------------------------------------------------------

export function wikiCategories(): any[] {
  return (app.store.all('linkrobins-wiki-categories') as any[]).slice().sort((a, b) => {
    const pa = Number(a.position()) || 0;
    const pb = Number(b.position()) || 0;

    return pa !== pb ? pa - pb : Number(a.id()) - Number(b.id());
  });
}

let categoriesRequested = false;

/**
 * Com a wiki em largura total, a coluna lateral dela (que carrega as
 * categorias) nem é montada: o dropdown pede a lista uma vez.
 */
export function ensureCategories(): void {
  if (categoriesRequested || app.store.all('linkrobins-wiki-categories').length) return;

  categoriesRequested = true;

  app.store
    .find('linkrobins-wiki-categories' as any, { sort: 'position', page: { limit: 100 } } as any)
    .then(() => m.redraw())
    .catch(() => {});
}

/** O símbolo do tema (quadradinho na cor, ou o ícone) para uma categoria da wiki. */
export function symbolOf(category: any): Mithril.Children {
  return categorySymbol(category as CanelaTag);
}

export function categoryUrl(key: string): string {
  return wikiIndexUrl({ category: key });
}

/** "▪ Guias" — o badge de categoria da lista, levando ao filtro da wiki. */
export function categoryBadge(category: any): Mithril.Children {
  return (
    <Link className="CanelaCategoryBadge" href={categoryUrl(String(category.id()))} title={category.description() || undefined}>
      {symbolOf(category)}
      <span className="CanelaCategoryBadge-name">{category.name()}</span>
    </Link>
  );
}

/**
 * O `category-chooser` do composer: "Categoria…" ou o badge da escolhida,
 * com "(sem categoria)" no topo da lista. `value` é o id (ou '').
 */
export function categoryChooser(value: string, onchange: (id: string) => void, className: string, disabled = false): Mithril.Children {
  const categories = wikiCategories();
  const chosen = value ? categories.find((category) => String(category.id()) === String(value)) : null;

  if (!categories.length) return null;

  const rows = (filter: string): SelectKitRow[] => {
    const needle = filter.trim().toLowerCase();
    const list: SelectKitRow[] = needle
      ? []
      : [
          {
            key: '',
            selected: !chosen,
            content: <div className="CanelaCategoryRow CanelaCategoryRow--none">{wt('compose.no_category', 'No category')}</div>,
          },
        ];

    categories
      .filter((category) => !needle || String(category.name()).toLowerCase().includes(needle))
      .forEach((category) =>
        list.push({
          key: String(category.id()),
          selected: chosen === category,
          title: category.name(),
          content: (
            <div className="CanelaCategoryRow">
              <div className="CanelaCategoryRow-status">
                <span className="CanelaChooserBadge">
                  {symbolOf(category)}
                  <span className="CanelaChooserBadge-name">{category.name()}</span>
                </span>
                <span className="CanelaCategoryRow-count">× {Number(category.articleCount?.() || 0)}</span>
              </div>
              {category.description() ? <div className="CanelaCategoryRow-desc">{category.description()}</div> : null}
            </div>
          ),
        })
      );

    return list;
  };

  return (
    <SelectKit
      className={classList(className, { 'has-selection': !!chosen })}
      label={t('thirdparty.wiki.category_placeholder')}
      disabled={disabled}
      filterIcon
      header={
        chosen ? (
          <span className="CanelaComposerFields-value">
            <span className="CanelaChooserBadge">
              {symbolOf(chosen)}
              <span className="CanelaChooserBadge-name">{chosen.name()}</span>
            </span>
          </span>
        ) : (
          <span className="CanelaComposerFields-placeholder">{t('thirdparty.wiki.category_placeholder')}</span>
        )
      }
      rows={rows}
      onselect={(key: string) => onchange(key)}
    />
  );
}
