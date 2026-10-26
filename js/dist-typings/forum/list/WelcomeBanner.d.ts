import Hero from 'flarum/forum/components/Hero';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
export default class WelcomeBanner extends Hero {
    className(): string;
    bodyItems(): ItemList<Mithril.Children>;
}
