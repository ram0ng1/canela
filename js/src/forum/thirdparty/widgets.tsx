/*
 * fof/forum-widgets-core no layout do tema, nos lugares do admin da extensão:
 *
 * - `start_top`/`start_bottom` (a coluna da esquerda): no começo e no fim da
 *   barra lateral global do tema. A barra da página de índice, onde a
 *   extensão os põe, o tema esconde (a navegação mora na barra global);
 * - `end` (a coluna da direita): ao lado da lista;
 * - `top`/`bottom`: linhas da largura toda dentro do container, acima e
 *   abaixo da lista e da coluna (a extensão os punha fora, e a largura não
 *   acompanhava a do cartão + a coluna).
 *
 * O visual dos cartões fica em less/forum/thirdparty/Widgets.less.
 *
 * Com a coluna, o cartão deixa o .Page-container e passa para o conteúdo
 * (classe CanelaPage--widgets): os widgets ficam fora do cartão, sobre o
 * fundo, na largura escolhida no admin (canela.widgets_width).
 *
 * Registrado no beforeMount: o initializer da extensão pode rodar depois do
 * tema (a ordem é a da lista de extensões), e o extend dela tem de vir antes.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../components/CanelaSidebar';
import { thirdParty } from './settings';
import { forumBool, forumInt } from '../utils/settings';

const NAMESPACE = 'fof-forum-widgets-core';

/** A largura da coluna (px), nos limites do admin. */
export function widgetsWidth(): number {
  return Math.min(480, Math.max(200, forumInt('canelaWidgetsWidth', 280)));
}

/**
 * O lugar tem widget nesta página: o gerenciador da extensão diz se a página
 * é das que têm widgets (a lista) e o que cada lugar tem.
 */
function hasWidgets(place: string): boolean {
  const widgets = (app as any).widgets;

  return !!widgets?.onWidgetPage?.() && (widgets.get(place) || []).length > 0;
}

function hasColumnWidgets(): boolean {
  return hasWidgets('end');
}

function section(name: string): any {
  try {
    return flarum.reg.get(NAMESPACE, `forum/components/${name}`) || null;
  } catch {
    return null;
  }
}

/** A barra lateral da página está escondida pelo tema (a partir do tablet, com a barra global ligada). */
function pageSidebarHidden(): boolean {
  return app.screen() !== 'phone' && forumBool('canelaSidebarEnabled', true);
}

export default function installWidgets(): void {
  app.beforeMount(() => {
    extend('flarum/forum/components/PageStructure' as any, 'sidebarItems', function (items: ItemList<Mithril.Children>) {
      if (!thirdParty.widgets() || !pageSidebarHidden()) return;

      if (items.has('startTopWidgetSection')) items.remove('startTopWidgetSection');
      if (items.has('startBottomWidgetSection')) items.remove('startBottomWidgetSection');
    });

    // A coluna da esquerda: no começo (acima do "Iniciar discussão") e no fim
    // da barra lateral global.
    extend(CanelaSidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
      if (!thirdParty.widgets() || !pageSidebarHidden()) return;

      const StartTop = section('StartTopWidgetSection');
      const StartBottom = section('StartBottomWidgetSection');

      if (StartTop && hasWidgets('start_top'))
        items.add(
          'canelaWidgetsStartTop',
          <div className="CanelaSidebarWidgets">
            <StartTop />
          </div>,
          200
        );
      if (StartBottom && hasWidgets('start_bottom'))
        items.add(
          'canelaWidgetsStartBottom',
          <div className="CanelaSidebarWidgets">
            <StartBottom />
          </div>,
          -1000
        );
    });

    // O topo e o pé saem de fora do container ...
    extend('flarum/forum/components/PageStructure' as any, 'mainItems', function (items: ItemList<Mithril.Children>) {
      if (!thirdParty.widgets()) return;

      if (items.has('topWidgetSection')) items.remove('topWidgetSection');
      if (items.has('bottomWidgetSection')) items.remove('bottomWidgetSection');
    });

    extend('flarum/forum/components/PageStructure' as any, 'containerItems', function (items: ItemList<Mithril.Children>) {
      if (!thirdParty.widgets()) return;

      // ... e entram nele, como linhas da largura toda.
      const Top = section('TopWidgetSection');
      const Bottom = section('BottomWidgetSection');

      if (Top && hasWidgets('top'))
        items.add(
          'canelaWidgetsTop',
          <div className="CanelaWidgetsRow CanelaWidgetsRow--top">
            <Top />
          </div>,
          1000
        );
      if (Bottom && hasWidgets('bottom'))
        items.add(
          'canelaWidgetsBottom',
          <div className="CanelaWidgetsRow CanelaWidgetsRow--bottom">
            <Bottom />
          </div>,
          -1000
        );

      if (!items.has('endWidgetSection') || !hasColumnWidgets()) return;

      const End = section('EndWidgetSection');

      items.setContent('endWidgetSection', <aside className="CanelaWidgets">{End ? <End /> : null}</aside>);
    });

    // Sem `:has()` no CSS: a classe vai direto no container (o `:has()` num
    // ancestral da página inteira faz o navegador recalcular a cada mudança).
    extend('flarum/forum/components/PageStructure' as any, 'container', function (vnode: any) {
      if (!thirdParty.widgets() || !vnode?.attrs) return;

      // As linhas de cima e de baixo pedem a quebra de linha do container.
      if (hasWidgets('top') || hasWidgets('bottom')) vnode.attrs.className = `${vnode.attrs.className || ''} CanelaPage--widgetRows`;

      if (!hasColumnWidgets()) return;

      const side = sideNow;

      vnode.attrs.className = `${vnode.attrs.className || ''} CanelaPage--widgets${side ? ` ${SIDE_CLASS}` : ''}`;
      vnode.attrs.style = { ...(vnode.attrs.style || {}), '--cn-widgets-width': `${widgetsWidth()}px` };
      vnode.attrs.oncreate = (dom: Mithril.VnodeDOM) => watchSide(dom.dom as HTMLElement);
      vnode.attrs.onremove = (dom: Mithril.VnodeDOM) => sideObserver?.unobserve((dom.dom as HTMLElement).parentElement as Element);
    });
  });
}

/** A coluna ao lado da lista: só quando cabem a lista (este mínimo), o espaço e a coluna. */
const MIN_LIST_WIDTH = 720;
const GAP = 24;
const SIDE_CLASS = 'CanelaPage--widgetsSide';

/** O último estado, para o próximo desenho já nascer com a classe certa (sem piscar). */
let sideNow = false;
let sideObserver: ResizeObserver | null = null;

/**
 * Decide pela largura da área da página (o .Page-main, que não depende da
 * classe), e não da tela: a barra lateral aberta ou fechada muda o espaço.
 * O ResizeObserver avisa depois do layout e antes da pintura.
 */
function watchSide(container: HTMLElement): void {
  const main = container.parentElement;

  if (!main || typeof ResizeObserver === 'undefined') return;

  sideObserver ||= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = (entry.target as HTMLElement).querySelector<HTMLElement>(':scope > .CanelaPage--widgets');

      if (!target) continue;

      const width = entry.contentRect.width;
      const side = app.screen() !== 'phone' && width >= MIN_LIST_WIDTH + GAP + widgetsWidth();

      sideNow = side;
      target.classList.toggle(SIDE_CLASS, side);
    }
  });

  sideObserver.observe(main);
}
