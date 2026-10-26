import type Mithril from 'mithril';
export declare function wikiCategories(): any[];
/**
 * Com a wiki em largura total, a coluna lateral dela (que carrega as
 * categorias) nem é montada: o dropdown pede a lista uma vez.
 */
export declare function ensureCategories(): void;
/** O símbolo do tema (quadradinho na cor, ou o ícone) para uma categoria da wiki. */
export declare function symbolOf(category: any): Mithril.Children;
export declare function categoryUrl(key: string): string;
/** "▪ Guias" — o badge de categoria da lista, levando ao filtro da wiki. */
export declare function categoryBadge(category: any): Mithril.Children;
/**
 * O `category-chooser` do composer: "Categoria…" ou o badge da escolhida,
 * com "(sem categoria)" no topo da lista. `value` é o id (ou '').
 */
export declare function categoryChooser(value: string, onchange: (id: string) => void, className: string, disabled?: boolean): Mithril.Children;
