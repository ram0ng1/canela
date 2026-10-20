/*
 * O topo da página de uma categoria no Horizon: o nome enorme, a descrição e
 * as subcategorias em cartões brancos com o símbolo colorido num quadrado.
 */
import app from 'flarum/forum/app';
import Hero, { type IHeroAttrs } from 'flarum/forum/components/Hero';
import Link from 'flarum/common/components/Link';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { categorySymbol, sortTags, tagSymbol, tagUrl, type CanelaTag } from '../utils/tags';

export interface CategoryHeroAttrs extends IHeroAttrs {
  // "model", e não "tag": o atributo `tag` some no caminho até o componente.
  model: CanelaTag;
}

export default class CategoryHero extends Hero<CategoryHeroAttrs> {
  className(): string {
    return 'CanelaCategoryHero';
  }

  style(): Record<string, string> | undefined {
    const color = this.attrs.model.color();

    return color ? { '--category-color': color } : undefined;
  }

  bodyItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const tag = this.attrs.model;
    const description = tag.description();

    // Etiqueta (tag secundária) com ícone no Flarum: o ícone antes do nome.
    const icon = tag.position() === null ? tagSymbol(tag, 'CanelaCategoryHero-icon') : null;

    items.add(
      'title',
      <h1 className="CanelaCategoryHero-title">
        {icon}
        {tag.name()}
      </h1>,
      100
    );

    if (description) {
      items.add('description', <p className="CanelaCategoryHero-description">{description}</p>, 90);
    }

    const children = forumBool('canelaCategoryHeroChildren', true) ? this.children() : [];

    if (children.length) {
      items.add(
        'children',
        <ul className="CanelaCategoryHero-children" aria-label={t('hero.subcategories')}>
          {children.map((child) => (
            <li>
              <Link className="CanelaSubcategoryCard" href={tagUrl(child)} style={child.color() ? { '--category-color': child.color() } : undefined}>
                <span className="CanelaSubcategoryCard-tile">{categorySymbol(child)}</span>
                <span className="CanelaSubcategoryCard-name">{child.name()}</span>
              </Link>
            </li>
          ))}
        </ul>,
        80
      );
    }

    return items;
  }

  children(): CanelaTag[] {
    const model = this.attrs.model;
    const children = model.children();

    if (Array.isArray(children)) return sortTags(children.filter(Boolean));

    // A relação só chega com o `include=children` do carregamento da tag, um
    // pedido depois de a página abrir: os cartões apareciam atrasados. As
    // filhas já vêm com o fórum (o flarum/tags carrega as tags com posição),
    // então saem já no primeiro desenho.
    return sortTags(app.store.all<CanelaTag>('tags').filter((tag) => tag.parent?.() === model));
  }
}
