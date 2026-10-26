import Hero, { type IHeroAttrs } from 'flarum/forum/components/Hero';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import { type CanelaTag } from '../utils/tags';
export interface CategoryHeroAttrs extends IHeroAttrs {
    model: CanelaTag;
}
export default class CategoryHero extends Hero<CategoryHeroAttrs> {
    className(): string;
    style(): Record<string, string> | undefined;
    bodyItems(): ItemList<Mithril.Children>;
    children(): CanelaTag[];
}
