/*
 * Os poucos ícones da casca que o Discourse desenha com o Lucide (traço de
 * 2px, pontas redondas) e que o Font Awesome do Flarum não tem com o mesmo
 * traço: o hambúrguer, a lupa da busca e o atalho da busca avançada. O CSS
 * (.CanelaIcon, em Header.less) dá cor e tamanho.
 */
import type Mithril from 'mithril';

// Os desenhos vêm da camada de ícones do tema (icons/glyphs.ts): os mesmos
// do Meta, numa fonte só.
import { lucideChildren } from '../icons';

function svg(className: string, children: Mithril.Children): Mithril.Children {
  return (
    <svg className={`CanelaIcon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** lucide "menu" */
export function menuIcon(): Mithril.Children {
  return svg('CanelaIcon--menu', lucideChildren('menu'));
}

/** lucide "search" */
export function searchIcon(): Mithril.Children {
  return svg('CanelaIcon--search', lucideChildren('search'));
}

/** lucide "sliders-horizontal" */
export function slidersIcon(): Mithril.Children {
  return svg('CanelaIcon--sliders', lucideChildren('sliders-horizontal'));
}
