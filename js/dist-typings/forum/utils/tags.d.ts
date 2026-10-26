import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
export interface CanelaTag {
    id(): string | undefined;
    name(): string;
    slug(): string;
    description(): string | null;
    color(): string | null;
    icon(): string | null;
    position(): number | null;
    isChild(): boolean;
    isHidden(): boolean;
    parent(): CanelaTag | false | null | undefined;
    children(): CanelaTag[] | false | undefined;
    discussionCount(): number;
    lastPostedAt(): Date | null | undefined;
    lastPostedDiscussion(): Discussion | false | null | undefined;
}
export declare function isTagsEnabled(): boolean;
export declare function allTags(): CanelaTag[];
/**
 * Mesma ordem do flarum/tags: as primárias pela posição, filhas logo depois do
 * pai, e as secundárias pelo nome.
 */
export declare function sortTags(tags: CanelaTag[]): CanelaTag[];
/** As "categorias": tags primárias de primeiro nível. */
export declare function primaryTags(): CanelaTag[];
/** As "etiquetas": tags secundárias, as mais usadas primeiro. */
export declare function secondaryTags(): CanelaTag[];
export declare function discussionTags(discussion: Discussion): CanelaTag[];
/** Separa as tags da discussão em categoria e etiquetas. */
export declare function splitDiscussionTags(discussion: Discussion): {
    categories: CanelaTag[];
    labels: CanelaTag[];
};
export declare function currentTag(): CanelaTag | null;
/**
 * Com os endereços próprios das listas ligados, /categories é a página de categorias
 * e /tags, a de etiquetas; sem eles, /tags (do flarum/tags) faz as duas vezes.
 */
export declare function separateTagsPage(): boolean;
/** A rota da página de categorias. */
export declare function categoriesRouteName(): string;
export declare function categoriesUrl(): string;
export declare function tagUrl(tag: CanelaTag): string;
/**
 * O símbolo da categoria: o ícone na cor dela ou,
 * sem ícone, um quadradinho preenchido.
 */
export declare function categorySymbol(tag: CanelaTag | null, className?: string): Mithril.Children;
/**
 * O símbolo da filha sem ícone: o quadradinho em duas cores, a do pai e a
 * dela (`.badge-category.--has-parent::before`).
 */
export declare function childSymbol(tag: CanelaTag, parent: CanelaTag): Mithril.Children;
/**
 * "▪ Suporte" — o badge de categoria, com ou sem link. Com o
 * pai, vira o badge da subcategoria: "▪ Suporte ▪ Instalação", um link só
 * (para a filha).
 */
export declare function categoryBadge(tag: CanelaTag, link?: boolean, parent?: CanelaTag | null): Mithril.Children;
/**
 * O ícone da etiqueta como o Flarum o define (na cor dela, quando houver).
 * Sem ícone, `fallback` (ex.: a etiqueta genérica da barra lateral) ou nada.
 * O ícone vai num <span> com `--tag-color` porque a cor é aplicada pelo CSS
 * de cada lugar (lista, barra, busca), que decide o tom quando ela falta.
 */
export declare function tagSymbol(tag: CanelaTag | null, className?: string, fallback?: string | null): Mithril.Children;
/** Etiqueta (tag secundária) no estilo simples: o ícone do Flarum, se houver, e o texto. */
export declare function labelBadge(tag: CanelaTag, link?: boolean): Mithril.Children;
/** Categoria(s) seguidas das etiquetas, na linha de baixo do título. */
export declare function discussionBadges(discussion: Discussion, link?: boolean): Mithril.Children;
