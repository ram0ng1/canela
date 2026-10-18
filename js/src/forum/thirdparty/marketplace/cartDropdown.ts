/*
 * A setinha do menu do carrinho (o 🛒 do cabeçalho) apontando para o ícone.
 *
 * O menu abre alinhado à direita do botão, e a largura dele muda com a tela
 * (360px, ou a tela toda menos a margem no celular): a posição da setinha sai
 * da conta entre o centro do botão e a borda esquerda do menu, a cada vez que
 * ele abre. O desenho mora no Marketplace.less (`--cn-mp-arrow-x`).
 */
import { extend } from 'flarum/common/extend';

import { thirdParty } from '../settings';

function placeArrow(root: Element | null | undefined): void {
  if (!root || !root.classList.contains('open')) return;

  const toggle = root.querySelector('.Dropdown-toggle');
  const menu = root.querySelector<HTMLElement>('.Dropdown-menu');

  if (!toggle || !menu) return;

  const button = toggle.getBoundingClientRect();
  const box = menu.getBoundingClientRect();
  const x = Math.round(button.left + button.width / 2 - box.left);

  // Sem cair para fora dos cantos arredondados do menu.
  menu.style.setProperty('--cn-mp-arrow-x', `${Math.max(16, Math.min(box.width - 16, x))}px`);
}

export default function installMarketplaceCartDropdown(): void {
  extend('ext:ramon/marketplace/forum/components/CartDropdown' as any, ['oncreate', 'onupdate'], function (this: any) {
    if (!thirdParty.marketplace()) return;

    const element = this.element as Element | undefined;

    requestAnimationFrame(() => placeArrow(element));
  });
}
