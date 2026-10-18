/*
 * As categorias da loja como a navegação da lista de tópicos.
 *
 * A extensão registra a rota /shop/category/{slug} e carrega as categorias,
 * mas a vitrine dela não tem como escolher uma: a rota mostrava tudo. Aqui a
 * vitrine ganha as categorias em pílulas ("Todas", "Extensões", "Camisetas"…)
 * no hero da loja, cada uma um link para a rota da categoria; na
 * rota, o filtro da própria extensão (`selectedCategory`, o `category` da API)
 * passa a valer, e o título do hero vira o nome da categoria.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { thirdParty } from '../settings';
import { findByClass } from '../ramonChat/views';

const VIEW = 'ext:ramon/marketplace/forum/components/DiscoverView';

interface ShopCategory {
  id: number;
  name: string;
  slug: string;
}

interface DiscoverState {
  categories: ShopCategory[];
  selectedCategory: number | null;
  products: unknown[];
  loading: boolean;
  fetch(reset: boolean): unknown;
  canelaSlug?: string | null;
}

/** Aplica o slug da rota assim que as categorias existem (do preload ou da API). */
function applySlug(view: DiscoverState): void {
  const slug = view.canelaSlug;

  if (!slug || !view.categories?.length) return;

  view.canelaSlug = null;

  const category = view.categories.find((c) => c.slug === slug);

  if (!category || view.selectedCategory === category.id) return;

  view.selectedCategory = category.id;
  view.loading = true;
  view.fetch(true);
}

function nav(view: DiscoverState): Mithril.Children {
  if (!view.categories?.length) return null;

  const current = view.selectedCategory;
  const tab = (key: string, href: string, label: string, active: boolean) => (
    <li key={key} className={classList('CanelaNav-tab', { active })}>
      <Link href={href}>{label}</Link>
    </li>
  );

  return (
    <nav className="CanelaMpCategories" aria-label={app.translator.trans('ramon-canela.forum.marketplace.categories', {}, true) as string}>
      <ul className="CanelaNav-tabs">
        {[
          tab('all', app.route('marketplace.shop'), app.translator.trans('ramon-canela.forum.marketplace.all', {}, true) as string, !current),
          ...view.categories.map((c) => tab(`c${c.id}`, app.route('marketplace.shop.category', { slug: c.slug }), c.name, current === c.id)),
        ]}
      </ul>
    </nav>
  );
}

export default function installMarketplaceCategories(): void {
  extend(VIEW as any, 'oninit' as any, function (this: DiscoverState) {
    if (!thirdParty.marketplace()) return;

    this.canelaSlug = (m.route.param('slug') as string | undefined) || null;

    // Já mostra o "carregando" em vez da vitrine inteira que o preload trouxe.
    if (this.canelaSlug) this.loading = true;

    applySlug(this);
  });

  extend(VIEW as any, 'view' as any, function (this: DiscoverState, vnode: Mithril.Children) {
    if (!thirdParty.marketplace()) return;

    applySlug(this);

    // A faixa do título da vitrine vira o hero da loja: a busca, a ordem e o
    // carrinho, e as categorias em pílulas, saem do conteúdo e vão para ela.
    const section = findByClass(vnode, 'MpShop-section');
    const hero = findByClass(vnode, 'CanelaMp-hero');
    const children = section?.children;

    if (Array.isArray(children)) {
      const index = children.findIndex((child: any) => findByClass(child, 'MpShop-toolbar') === child);

      if (hero && Array.isArray(hero.children) && index !== -1) {
        const [toolbar] = children.splice(index, 1);
        hero.children.push(toolbar, nav(this));
      } else {
        children.splice(index + 1, 0, nav(this));
      }
    }

    // O título do hero é o nome da categoria escolhida.
    const category = this.categories?.find((c) => c.id === this.selectedCategory);
    const title = category ? (findByClass(vnode, 'MpShop-header') as any)?.children?.find?.((c: any) => c?.tag === 'h1') : null;

    if (title) {
      title.text = undefined;
      title.children = [m.fragment({}, [category!.name])];
    }
  });
}
