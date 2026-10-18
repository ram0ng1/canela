/*
 * Os links da loja do ramon/marketplace como uma seção da barra lateral.
 *
 * A extensão põe na navegação um item "Loja" que abre um submenu ao passar o
 * mouse (MpHoverNavItem). Na barra do tema ele abria para a esquerda, cortado
 * pela borda da tela, e um menu flutuante preso a um link da barra não existe
 * no Discourse: lá, um grupo de links é uma seção recolhível, como "Categorias"
 * e "Etiquetas" (e as seções personalizadas). Então o "Loja" sai da seção da
 * comunidade e os links dele viram a seção "Loja", que lembra se o leitor a
 * recolheu e funciona igual no painel deslizante do celular.
 *
 * A lista é a da própria extensão (os `subItems` do item dela): o que o admin
 * dela esconde em Navegação, ou desliga (cursos, planos, vendedores…), some
 * daqui também. À vista ficam só a loja, o carrinho (com a contagem), os
 * pedidos e os downloads; o resto mora no "Mais" da seção, como o da seção da
 * comunidade, e os itens de vendedor só aparecem para quem vende. As
 * "Mensagens" da loja viram "Mensagens da loja" (as do fórum são outra coisa).
 * Nas páginas "de dentro" de um item (o curso aberto, o pedido, o produto, o
 * checkout) o item pai fica aceso; se ele morar no "Mais", sobe para a lista.
 * O visitante continua com o link simples "Loja".
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import Dropdown from 'flarum/common/components/Dropdown';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import SidebarSection from '../../components/SidebarSection';
import { t } from '../../utils/settings';
import { thirdParty } from '../settings';

interface ShopLink {
  href: string;
  icon: string;
  label: Mithril.Children;
  onclick?: (e: MouseEvent) => void;
}

/** Os links do submenu da extensão, guardados por instância da barra a cada desenho. */
const shopLinks = new WeakMap<object, ShopLink[]>();

export default function installMarketplaceSidebar(): void {
  extend(IndexSidebar.prototype, 'navItems', function (this: IndexSidebar, items: ItemList<Mithril.Children>) {
    if (!(this instanceof CanelaSidebar) || !thirdParty.marketplaceSidebar() || !items.has('marketplace-shop')) return;

    const subItems = (items.get('marketplace-shop') as any)?.attrs?.subItems as ShopLink[] | undefined;

    // Sem submenu (visitante), o "Loja" é um link comum e fica onde está.
    if (!Array.isArray(subItems)) return;

    shopLinks.set(this, subItems);
    items.remove('marketplace-shop');

    // O atalho que a extensão só mostra no seletor do celular do avocado.
    if (items.has('marketplace-dashboard-mobile')) items.remove('marketplace-dashboard-mobile');
  });

  extend(CanelaSidebar.prototype, 'sectionItems', function (this: CanelaSidebar, items: ItemList<Mithril.Children>) {
    // O sectionItems já desenhou a seção da comunidade, que chama o navItems.
    const links = shopLinks.get(this);

    if (!links?.length || !thirdParty.marketplaceSidebar()) return;

    const { main, more } = splitLinks(links);

    items.add(
      'marketplace',
      <SidebarSection name="marketplace" title={app.translator.trans('ramon-marketplace.forum.nav.shop', {}, true)}>
        {main.map((link) => (
          <li className="CanelaSidebar-marketplaceItem">{linkButton(link)}</li>
        ))}
        {more.length > 0 && (
          <li className="CanelaSidebar-marketplaceItem CanelaSidebar-marketplaceMore">
            <Dropdown
              className="CanelaSidebar-more"
              buttonClassName="CanelaSidebar-moreButton"
              icon="fas fa-ellipsis-vertical"
              label={t('sidebar.more')}
              caretIcon={null}
              accessibleToggleLabel={t('sidebar.more')}
            >
              {more.map((link) => linkButton(link))}
            </Dropdown>
          </li>
        )}
      </SidebarSection>,
      // Como as seções personalizadas do Discourse: depois dos links (85) e
      // antes das tags (80).
      82
    );
  });
}

/** As rotas que ficam à vista na seção; o resto vai para o "Mais". */
const MAIN_ROUTES = ['marketplace.shop', 'marketplace.cart', 'marketplace.orders', 'marketplace.downloads'];

/**
 * As rotas "de dentro" de cada item: numa delas, o item fica ativo (o curso
 * aberto acende "Meus cursos", o produto acende a loja, o checkout acende o
 * carrinho…). Item fora da lista acende só na própria rota.
 */
const ACTIVE_ROUTES: Record<string, string[]> = {
  'marketplace.shop': [
    'marketplace.shop',
    'marketplace.shop.category',
    'marketplace.shop.legacy',
    'marketplace.shop.legacy.category',
    'marketplace.extension',
    'marketplace.item',
    'marketplace.product',
    'marketplace.bundle',
  ],
  'marketplace.cart': ['marketplace.cart', 'marketplace.checkout', 'marketplace.checkout.success'],
  'marketplace.orders': ['marketplace.orders', 'marketplace.order.detail'],
  'marketplace.my_courses': ['marketplace.my_courses', 'marketplace.course'],
  'marketplace.messages': ['marketplace.messages', 'marketplace.conversation'],
  'marketplace.collections': ['marketplace.collections', 'marketplace.collection'],
  'marketplace.packages': ['marketplace.packages', 'marketplace.ticket'],
};

function isActive(link: ShopLink): boolean {
  const route = routeOf(link.href);
  const current = String(app.current.get('routeName') || '');

  if (!route || !current) return false;

  return (ACTIVE_ROUTES[route] || [route]).includes(current);
}

/** Rotas só de quem vende (a extensão mostra a todos com o multivendedor ligado). */
const SELLER_ROUTES = ['marketplace.store', 'marketplace.my_products', 'marketplace.my_coupons'];

/** O nome da rota de cada link (guardado: a barra redesenha a toda hora). */
const routeNames = new Map<string, string | null>();

function routeOf(href: string): string | null {
  const path = href.split('?')[0];

  if (routeNames.has(path)) return routeNames.get(path)!;

  routeNames.set(path, findRoute(path));

  return routeNames.get(path)!;
}

function findRoute(path: string): string | null {
  for (const [name, route] of Object.entries(app.routes)) {
    try {
      if ((route as any).path && app.route(name) === path) return name;
    } catch {
      // Rota com parâmetro: não é link da seção.
    }
  }

  return null;
}

function splitLinks(links: ShopLink[]): { main: ShopLink[]; more: ShopLink[] } {
  const user = app.session.user;
  const seller = !!user && (!!user.attribute('marketplaceCanSell') || !!user.attribute('marketplaceStoreStatus'));
  const main: ShopLink[] = [];
  const more: ShopLink[] = [];

  links.forEach((link) => {
    const route = routeOf(link.href);

    if (route && SELLER_ROUTES.includes(route) && !seller) return;

    (route && MAIN_ROUTES.includes(route) ? main : more).push(
      route === 'marketplace.messages' ? { ...link, label: t('marketplace.shop_messages') } : link
    );
  });

  // Na ordem das rotas principais (a loja primeiro, o carrinho logo depois).
  main.sort((a, b) => MAIN_ROUTES.indexOf(routeOf(a.href) || '') - MAIN_ROUTES.indexOf(routeOf(b.href) || ''));

  // O item ativo que mora no "Mais" sobe para a lista visível enquanto a
  // página dele estiver aberta: um item aceso escondido no menu não serviria.
  const promoted = more.findIndex(isActive);

  if (promoted !== -1) main.push(...more.splice(promoted, 1));

  return { main, more };
}

/** Quantos itens o carrinho tem, do estado da própria extensão. */
function cartCount(): number {
  const store = (flarum as any).reg.checkModule('ramon-marketplace', 'common/utils/cartStore')?.cartStore;
  const state = store?.get?.();

  if (!state) return 0;

  return Number(state.totals?.count) || (state.items || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
}

function linkButton(link: ShopLink): Mithril.Children {
  const count = routeOf(link.href) === 'marketplace.cart' ? cartCount() : 0;

  return (
    <LinkButton href={link.href} icon={link.icon} onclick={link.onclick} active={isActive(link)}>
      {link.label}
      {count > 0 && <span className="CanelaSidebar-suffix CanelaSidebar-count">{count > 99 ? '99+' : count}</span>}
    </LinkButton>
  );
}
