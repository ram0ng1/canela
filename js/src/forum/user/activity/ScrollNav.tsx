/*
 * Uma linha de abas que rola na
 * horizontal e, quando não cabe, ganha setas ‹ › nas pontas (e a borda que
 * esmaece) do lado em que ainda há abas escondidas.
 *
 * As classes `--left`/`--right` são trocadas direto no DOM, no scroll e no
 * resize: redesenhar o Mithril a cada pixel rolado seria desperdício.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

export interface ScrollNavAttrs extends ComponentAttrs {
  className?: string;
}

/** Folga, em px, para arredondamentos do scroll (zoom, telas de alta densidade). */
const EDGE = 2;

export default class ScrollNav extends Component<ScrollNavAttrs> {
  private list: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private readonly sync = () => this.updateArrows();

  view(vnode: Mithril.Vnode<ScrollNavAttrs, this>) {
    return (
      <div className="CanelaScrollNav">
        <button
          type="button"
          className="CanelaScrollNav-arrow CanelaScrollNav-arrow--left"
          tabindex="-1"
          aria-label={t('user.nav.scroll_left')}
          onclick={() => this.scrollBy(-1)}
        >
          <Icon name="fas fa-chevron-left" />
        </button>
        <ul className={classList('CanelaScrollNav-list', this.attrs.className)}>{vnode.children}</ul>
        <button
          type="button"
          className="CanelaScrollNav-arrow CanelaScrollNav-arrow--right"
          tabindex="-1"
          aria-label={t('user.nav.scroll_right')}
          onclick={() => this.scrollBy(1)}
        >
          <Icon name="fas fa-chevron-right" />
        </button>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.oncreate(vnode);

    this.list = this.element.querySelector('.CanelaScrollNav-list');
    this.list?.addEventListener('scroll', this.sync, { passive: true });

    if (typeof ResizeObserver !== 'undefined' && this.list) {
      this.observer = new ResizeObserver(this.sync);
      this.observer.observe(this.list);
    } else {
      window.addEventListener('resize', this.sync);
    }

    // A aba ativa à vista, mesmo quando é uma aba do fim da linha.
    const active = this.list?.querySelector<HTMLElement>('[active="true"], .active');

    if (this.list && active) {
      const left = active.offsetLeft - this.list.offsetLeft;
      const right = left + active.offsetWidth;

      if (right > this.list.scrollLeft + this.list.clientWidth || left < this.list.scrollLeft) {
        this.list.scrollLeft = Math.max(0, left - this.list.clientWidth / 3);
      }
    }

    this.updateArrows();
  }

  onupdate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.onupdate(vnode);

    this.updateArrows();
  }

  onremove(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.onremove(vnode);

    this.list?.removeEventListener('scroll', this.sync);
    this.observer?.disconnect();
    window.removeEventListener('resize', this.sync);
  }

  private updateArrows(): void {
    const list = this.list;

    if (!list || !this.element) return;

    const max = list.scrollWidth - list.clientWidth;
    // `scrollLeft` fica negativo em páginas da direita para a esquerda.
    const position = Math.abs(list.scrollLeft);

    this.element.classList.toggle('CanelaScrollNav--left', max > EDGE && position > EDGE);
    this.element.classList.toggle('CanelaScrollNav--right', max > EDGE && position < max - EDGE);
  }

  private scrollBy(direction: -1 | 1): void {
    const list = this.list;

    if (!list) return;

    const rtl = getComputedStyle(list).direction === 'rtl' ? -1 : 1;

    list.scrollBy({ left: direction * rtl * Math.max(120, list.clientWidth * 0.6), behavior: 'smooth' });
  }
}
