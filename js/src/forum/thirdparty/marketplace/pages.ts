/*
 * As telas do ramon/marketplace encaixadas na casca do tema, sem editar a
 * extensão: cada `view()` dela passa por aqui depois de desenhada (o `extend`
 * pelo nome do módulo também alcança as páginas que são chunks sob demanda).
 *
 * - Páginas: o cabeçalho da página (`.MpX-header`: o título, a contagem e as
 *   ações) sai do conteúdo e fica em cima, sobre o fundo tingido, como os
 *   heros do tema (banner de boas-vindas, categoria); o resto vai para dentro
 *   do cartão `.CanelaMp-card`, o mesmo cartão da lista de tópicos. A página
 *   sem cabeçalho (produto, curso) fica inteira no cartão.
 * - Ícones: a extensão desenha os ícones como `<i class="fas fa-x">` cru, por
 *   fora do componente `Icon` por onde o tema troca o Font Awesome pelo
 *   Lucide; aqui eles viram `Icon` (o mesmo `lucidify` do ramon/chat).
 *
 * O visual mora em less/forum/thirdparty/Marketplace.less.
 */
import { extend } from 'flarum/common/extend';
import type Mithril from 'mithril';

import { thirdParty } from '../settings';
import { findByClass, lucidify } from '../ramonChat/views';

const MODULE = 'ext:ramon/marketplace/forum/components/';

/**
 * As páginas (rotas) da extensão, e o DiscoverView, que desenha a vitrine
 * inteira (a ShopPage é só uma casca em volta dele).
 */
const PAGES = [
  'DiscoverView',
  'BundlePage',
  'CartPage',
  'CheckoutPage',
  'CheckoutSuccessPage',
  'CollectionPage',
  'CollectionsPage',
  'ConversationPage',
  'CoursePlayerPage',
  'CoursesStorePage',
  'DownloadsPage',
  'GiftCardsPage',
  'InviteClaimPage',
  'MyCouponsPage',
  'MyCoursesPage',
  'MyMarketplacePage',
  'MyMessagesPage',
  'MyOrdersPage',
  'MyProductsPage',
  'MyRefundRequestsPage',
  'MyStorePage',
  'MySubscriptionsPage',
  'MyWishlistPage',
  'OrderDetailPage',
  'PackagesPage',
  'PlansPage',
  'ProductPage',
  'ShopPage',
  'TicketPage',
];

/** Os outros componentes com `<i>` cru: menus, modais, blocos do perfil, cartões. */
const COMPONENTS = [
  'CartDropdown',
  'DiscoverProductView',
  'MpProductEmbed',
  'MpProductEmbedModal',
  'MpRefundRequestModal',
  'MpSortDropdown',
  'ReportProductModal',
  'ReviewsProfileSection',
  'SellerAnalytics',
  'SellerProductModal',
  'SellerProfileSection',
  'StoreVerifiedBadge',
  'WishlistButton',
];

/**
 * O cabeçalho de página da extensão: `.MpShop-header`, `.MpAccount-header`…,
 * e os títulos grandes da vitrine de cursos e da página de planos.
 */
const HEADER = /(^|\s)((Mp[A-Za-z]+|MarketplacePage)-header|MpCoursesHero|MpPlans-head)(\s|$)/;

type AnyVnode = Mithril.Vnode<any, any> & { attrs?: Record<string, any>; children?: any; text?: unknown };

function classes(vnode: AnyVnode): string {
  return String(vnode?.attrs?.className || vnode?.attrs?.class || '');
}

/** Um elemento HTML (não componente, texto nem fragmento). */
function isElement(node: unknown): node is AnyVnode {
  const vnode = node as AnyVnode;

  return !!vnode && typeof vnode === 'object' && typeof vnode.tag === 'string' && !['#', '[', '<'].includes(vnode.tag);
}

function addClass(vnode: AnyVnode, className: string): void {
  vnode.attrs = vnode.attrs || {};
  const key = 'class' in vnode.attrs && !('className' in vnode.attrs) ? 'class' : 'className';
  vnode.attrs[key] = `${vnode.attrs[key] || ''} ${className}`.trim();
}

/**
 * Onde está o cabeçalho da página: o elemento (até três níveis abaixo da raiz)
 * que o tem como filho, e a lista onde ele está — a do elemento, ou a de um
 * fragmento dentro dele (`{cond && [<header/>, …]}`).
 */
function headerParent(node: AnyVnode, depth = 0): { parent: AnyVnode; holder: any[]; index: number } | null {
  if (!Array.isArray(node.children)) return null;

  const scan = (holder: any[]): { holder: any[]; index: number } | null => {
    for (let i = 0; i < holder.length; i++) {
      const child = holder[i];

      if (isElement(child) && HEADER.test(classes(child))) return { holder, index: i };
      if (child && typeof child === 'object' && child.tag === '[' && Array.isArray(child.children)) {
        const found = scan(child.children);
        if (found) return found;
      }
    }

    return null;
  };

  const direct = scan(node.children);

  if (direct) return { parent: node, ...direct };
  if (depth >= 3) return null;

  for (const child of node.children) {
    if (!isElement(child)) continue;

    const found = headerParent(child, depth + 1);

    if (found) return found;
  }

  return null;
}

/** A raiz de conteúdo da página: a própria raiz, ou o primeiro filho com classe (a raiz da ShopPage é um `<div>` sem classe). */
function contentRoot(root: AnyVnode): AnyVnode | null {
  if (classes(root)) return root;
  if (!Array.isArray(root.children)) return null;

  return (
    (root.children as unknown[]).find((child): child is AnyVnode => isElement(child) && !!classes(child) && !/MpNav-helper/.test(classes(child))) ??
    null
  );
}

/** Título fora do cartão e o resto dentro dele. */
function frame(root: unknown): void {
  if (!isElement(root)) return;

  const found = headerParent(root);
  const page = found?.parent ?? contentRoot(root);

  if (!page || !Array.isArray(page.children)) return;

  const header = found ? found.holder.splice(found.index, 1)[0] : null;
  const children = page.children.slice();

  addClass(page, header ? 'CanelaMp-page' : 'CanelaMp-page CanelaMp-page--solo');
  page.text = undefined;
  page.children = header
    ? [m('div', { className: 'CanelaMp-hero' }, header), m('div', { className: 'CanelaMp-card' }, children)]
    : [m('div', { className: 'CanelaMp-card' }, children)];
}

/** Põe um vnode na lista, com `key` se os irmãos tiverem (o Mithril exige todos ou nenhum). */
function insert(holder: any[], index: number, vnode: AnyVnode, key: string): void {
  if (holder.some((child) => child && typeof child === 'object' && child.key != null)) vnode.key = key;
  holder.splice(index, 0, vnode);
}

/** Tira da árvore o primeiro elemento com a classe e devolve-o. */
function take(node: unknown, className: string): AnyVnode | null {
  const vnode = node as AnyVnode;

  if (!vnode || typeof vnode !== 'object' || !Array.isArray(vnode.children)) return null;

  for (let i = 0; i < vnode.children.length; i++) {
    const child = vnode.children[i];

    if (isElement(child) && classes(child).split(/\s+/).includes(className)) {
      vnode.children.splice(i, 1);

      return child;
    }

    const found = take(child, className);

    if (found) return found;
  }

  return null;
}

/**
 * A ficha do produto como uma página de loja:
 *
 * - duas colunas: à esquerda o título, o aviso do Composer, as abas e
 *   as seções; à direita a caixa de compra (preço e botões, que estavam no
 *   topo), fixa ao rolar, e os blocos de informações.
 */
function productSheet(root: unknown): void {
  const card = findByClass(root, 'CanelaMp-card') as AnyVnode | null;
  const cols = findByClass(root, 'MpProduct-cols') as AnyVnode | null;
  const main = findByClass(root, 'MpProduct-main') as AnyVnode | null;
  const aside = findByClass(root, 'MpProduct-sidebar') as AnyVnode | null;

  if (!card || !cols || !main || !aside || !Array.isArray(card.children) || !Array.isArray(main.children) || !Array.isArray(aside.children)) return;

  const hero = take(card, 'MpProduct-hero');
  const hint = take(card, 'MpProduct-composerHint');
  const buy = hero ? take(hero, 'MpProduct-heroRight') : null;

  // A imagem do produto fica no título (o ícone do hero) e as capturas de
  // tela ficam na seção "Capturas" da Visão geral, como na extensão: nada de
  // promover uma delas a capa larga no topo.
  if (hint) insert(main.children, 0, hint, 'canela-hint');
  if (hero) insert(main.children, 0, hero, 'canela-hero');

  if (buy) {
    addClass(buy, 'CanelaMpBuyBox');
    insert(aside.children, 0, buy, 'canela-buy');
  }
}

export default function installMarketplacePages(): void {
  PAGES.forEach((name) => {
    extend(`${MODULE}${name}` as any, 'view', function (vnode: Mithril.Children) {
      if (!thirdParty.marketplace()) return;

      lucidify([vnode]);
      frame(vnode);
      if (name === 'ProductPage') productSheet(vnode);
    });
  });

  COMPONENTS.forEach((name) => {
    extend(`${MODULE}${name}` as any, 'view', function (vnode: Mithril.Children) {
      if (thirdParty.marketplace()) lucidify([vnode]);
    });
  });
}
