/*
 * Acesso às tags sem depender do flarum/tags em tempo de build.
 *
 * O tema funciona sem a extensão de tags: sem ela, `discussion.tags` nem existe
 * no modelo e `app.currentTag` não está definido. O pouco que o tema precisa
 * (nome, cor, ícone, hierarquia) é lido direto do modelo, que é o mesmo nas
 * duas situações.
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled } from './settings';

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

export function isTagsEnabled(): boolean {
  return isExtensionEnabled('flarum-tags');
}

export function allTags(): CanelaTag[] {
  return isTagsEnabled() ? (app.store.all('tags') as unknown as CanelaTag[]) : [];
}

/**
 * Mesma ordem do flarum/tags: as primárias pela posição, filhas logo depois do
 * pai, e as secundárias pelo nome.
 */
export function sortTags(tags: CanelaTag[]): CanelaTag[] {
  return tags.slice().sort((a, b) => {
    const aParent = a.isChild() ? (a.parent() as CanelaTag) : null;
    const bParent = b.isChild() ? (b.parent() as CanelaTag) : null;
    const aPos = a.position();
    const bPos = b.position();

    if (aParent && aParent === bParent) return (aPos ?? 0) - (bPos ?? 0);
    if (aParent && bParent) return (aParent.position() ?? 0) - (bParent.position() ?? 0);
    if (aParent) return aParent === b ? 1 : (aParent.position() ?? 0) - (bPos ?? 0);
    if (bParent) return bParent === a ? -1 : (aPos ?? 0) - (bParent.position() ?? 0);

    if (aPos === null && bPos === null) return b.discussionCount() - a.discussionCount();
    if (bPos === null) return -1;
    if (aPos === null) return 1;

    return aPos - bPos;
  });
}

/** As "categorias": tags primárias de primeiro nível. */
export function primaryTags(): CanelaTag[] {
  return sortTags(allTags().filter((tag) => tag.position() !== null && !tag.isChild()));
}

/** As "etiquetas": tags secundárias, as mais usadas primeiro. */
export function secondaryTags(): CanelaTag[] {
  return allTags()
    .filter((tag) => tag.position() === null)
    .sort((a, b) => b.discussionCount() - a.discussionCount());
}

export function discussionTags(discussion: Discussion): CanelaTag[] {
  if (!isTagsEnabled()) return [];

  const tags = (discussion as any).tags?.();

  return Array.isArray(tags) ? sortTags(tags.filter(Boolean)) : [];
}

/** Separa as tags da discussão em categoria e etiquetas. */
export function splitDiscussionTags(discussion: Discussion): { categories: CanelaTag[]; labels: CanelaTag[] } {
  const tags = discussionTags(discussion);

  return {
    categories: tags.filter((tag) => tag.position() !== null),
    labels: tags.filter((tag) => tag.position() === null),
  };
}

export function currentTag(): CanelaTag | null {
  if (!isTagsEnabled()) return null;

  return (app as any).currentTag?.() ?? null;
}

/**
 * Com os endereços próprios das listas ligados, /categories é a página de categorias
 * e /tags, a de etiquetas; sem eles, /tags (do flarum/tags) faz as duas vezes.
 */
export function separateTagsPage(): boolean {
  return forumBool('canelaListRoutes', false);
}

/** A rota da página de categorias. */
export function categoriesRouteName(): string {
  return separateTagsPage() ? 'canela.categories' : 'tags';
}

export function categoriesUrl(): string {
  return app.route(categoriesRouteName());
}

export function tagUrl(tag: CanelaTag): string {
  return app.route('tag', { tags: tag.slug() });
}

/**
 * O símbolo da categoria: o ícone na cor dela ou,
 * sem ícone, um quadradinho preenchido.
 */
export function categorySymbol(tag: CanelaTag | null, className = ''): Mithril.Children {
  const color = tag?.color() || '';
  const icon = tag?.icon();

  return (
    <span
      className={classList('CanelaCategorySymbol', className, { 'CanelaCategorySymbol--square': !icon })}
      style={color ? { '--category-color': color } : undefined}
      aria-hidden="true"
    >
      {icon ? <Icon name={icon} /> : null}
    </span>
  );
}

/**
 * O símbolo da filha sem ícone: o quadradinho em duas cores, a do pai e a
 * dela (`.badge-category.--has-parent::before`).
 */
function childSymbol(tag: CanelaTag, parent: CanelaTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);

  if (!tag.icon() && symbol?.attrs) {
    symbol.attrs.className = classList(symbol.attrs.className, 'CanelaCategorySymbol--split');
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--cn-primary-medium)' };
  }

  return symbol;
}

/**
 * "▪ Suporte" — o badge de categoria, com ou sem link. Com o
 * pai, vira o badge da subcategoria: "▪ Suporte ▪ Instalação", um link só
 * (para a filha).
 */
export function categoryBadge(tag: CanelaTag, link = true, parent: CanelaTag | null = null): Mithril.Children {
  const content = parent
    ? [
        categorySymbol(parent),
        <span className="CanelaCategoryBadge-name CanelaCategoryBadge-parent">{parent.name()}</span>,
        childSymbol(tag, parent),
        <span className="CanelaCategoryBadge-name">{tag.name()}</span>,
      ]
    : [categorySymbol(tag), <span className="CanelaCategoryBadge-name">{tag.name()}</span>];
  // A cor também no badge: na lista, ela pinta o fundo da pílula.
  const attrs = {
    className: classList('CanelaCategoryBadge', { 'CanelaCategoryBadge--child': !!parent }),
    title: tag.description() || undefined,
    style: tag.color() ? { '--category-color': tag.color() } : undefined,
  };

  return link ? (
    <Link {...attrs} href={tagUrl(tag)}>
      {content}
    </Link>
  ) : (
    <span {...attrs}>{content}</span>
  );
}

/**
 * O ícone da etiqueta como o Flarum o define (na cor dela, quando houver).
 * Sem ícone, `fallback` (ex.: a etiqueta genérica da barra lateral) ou nada.
 * O ícone vai num <span> com `--tag-color` porque a cor é aplicada pelo CSS
 * de cada lugar (lista, barra, busca), que decide o tom quando ela falta.
 */
export function tagSymbol(tag: CanelaTag | null, className = '', fallback: string | null = null): Mithril.Children {
  const icon = tag?.icon() || fallback;

  if (!icon) return null;

  const color = tag?.color() || '';

  return (
    <span
      className={classList('CanelaTagSymbol', className, { 'CanelaTagSymbol--colored': !!color })}
      style={color ? { '--tag-color': color } : undefined}
      aria-hidden="true"
    >
      <Icon name={icon} />
    </span>
  );
}

/** Etiqueta (tag secundária) no estilo simples: o ícone do Flarum, se houver, e o texto. */
export function labelBadge(tag: CanelaTag, link = true): Mithril.Children {
  const attrs = { className: 'CanelaTagBadge', title: tag.description() || undefined };
  const content = [tagSymbol(tag), <span>{tag.name()}</span>];

  return link ? (
    <Link {...attrs} href={tagUrl(tag)}>
      {content}
    </Link>
  ) : (
    <span {...attrs}>{content}</span>
  );
}

/** Categoria(s) seguidas das etiquetas, na linha de baixo do título. */
export function discussionBadges(discussion: Discussion, link = true): Mithril.Children {
  const { categories, labels } = splitDiscussionTags(discussion);

  if (!categories.length && !labels.length) return null;

  // Como no Flarum: cada tag no seu badge, a pai uma vez só e cada filha
  // logo depois dela (ordem do `sortTags`), sem repetir o pai na frente.
  return (
    <span className="CanelaBadges">
      {categories.map((tag) => categoryBadge(tag, link))}
      {labels.length > 0 && <span className="CanelaBadges-labels">{labels.map((tag) => labelBadge(tag, link))}</span>}
    </span>
  );
}
