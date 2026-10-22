import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { prefersReducedMotion } from '../motion/motionUtils';
import { getCommunityMore, getCommunityOrder, setCommunityMore, setCommunityOrder } from '../utils/sidebarPrefs';

export interface CommunityEntry {
  key: string;
  label: string;
  icon?: string;
}

export interface CommunityCustomizeModalAttrs extends IInternalModalAttrs {
  /** Os itens da seção, na ordem em que aparecem agora. */
  entries: CommunityEntry[];
  onsave?: () => void;
}

/** O tempo dos vizinhos deslizando para o lugar novo (ms). */
const SLIDE = 150;

/**
 * Quais itens da seção principal da barra lateral ficam à vista (os
 * desmarcados vão para dentro do "Mais") e em que ordem: cada linha se
 * arrasta pela alça (⋮⋮), com o mouse ou o dedo — Pointer Events, porque o
 * arrastar nativo do HTML não funciona no toque do iOS. Com o foco na alça,
 * as setas do teclado fazem o mesmo. As linhas têm `key`: o elemento
 * arrastado (e o foco) acompanha o item.
 */
export default class CommunityCustomizeModal extends Modal<CommunityCustomizeModalAttrs> {
  hidden = new Set<string>();
  order: string[] = [];
  dragging: string | null = null;

  oninit(vnode: Mithril.Vnode<CommunityCustomizeModalAttrs, this>) {
    super.oninit(vnode);

    this.hidden = new Set(getCommunityMore());
    this.order = this.attrs.entries.map((entry) => entry.key);
  }

  className() {
    return 'CanelaSidebarCustomize Modal--small';
  }

  title() {
    return t('sidebar.customize_community');
  }

  content(): Mithril.Children {
    const byKey = new Map(this.attrs.entries.map((entry) => [entry.key, entry]));

    return (
      <div className="Modal-body">
        <p className="helpText">{t('sidebar.customize_community_help')}</p>

        <ul className={classList('CanelaSidebarCustomize-list', { 'CanelaSidebarCustomize-list--dragging': this.dragging })}>
          {this.order.map((key) => {
            const entry = byKey.get(key)!;

            return (
              <li
                key={key}
                data-key={key}
                className={classList('CanelaSidebarCustomize-row', { 'CanelaSidebarCustomize-row--dragging': this.dragging === key })}
              >
                <button
                  type="button"
                  className="Button--ua-reset CanelaSidebarCustomize-handle"
                  aria-label={t('sidebar.customize_drag', { item: entry.label })}
                  onpointerdown={(event: PointerEvent) => this.startDrag(event, key)}
                  onkeydown={(event: KeyboardEvent) => this.keyMove(event, key)}
                >
                  <Icon name="fas fa-grip-vertical" />
                </button>
                <label className="checkbox">
                  <input type="checkbox" checked={!this.hidden.has(key)} onchange={() => this.toggle(key)} />
                  {entry.icon && <Icon name={entry.icon} />}
                  <span>{entry.label}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="CanelaSidebarCustomize-actions">
          <Button className="Button Button--primary" onclick={() => this.save()}>
            {t('sidebar.customize_save')}
          </Button>
          <Button className="Button Button--link" onclick={() => this.reset()}>
            {t('sidebar.customize_reset')}
          </Button>
        </div>
      </div>
    );
  }

  toggle(key: string) {
    if (this.hidden.has(key)) this.hidden.delete(key);
    else this.hidden.add(key);
  }

  /** Põe o item na posição `index` e faz os vizinhos deslizarem até o lugar novo. */
  moveTo(key: string, index: number) {
    const from = this.order.indexOf(key);

    if (from === index || index < 0 || index >= this.order.length) return;

    const list = this.element.querySelector<HTMLElement>('.CanelaSidebarCustomize-list');
    const before = new Map<string, number>();

    list
      ?.querySelectorAll<HTMLElement>('.CanelaSidebarCustomize-row')
      .forEach((row) => before.set(row.dataset.key!, row.getBoundingClientRect().top));

    this.order.splice(from, 1);
    this.order.splice(index, 0, key);
    m.redraw.sync();

    if (!list || prefersReducedMotion()) return;

    // FLIP: cada linha que mudou de lugar parte de onde estava.
    list.querySelectorAll<HTMLElement>('.CanelaSidebarCustomize-row').forEach((row) => {
      const delta = (before.get(row.dataset.key!) ?? 0) - row.getBoundingClientRect().top;

      if (Math.abs(delta) >= 1 && row.dataset.key !== this.dragging) {
        row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: SLIDE, easing: 'ease-out' });
      }
    });
  }

  /**
   * Arrastar pela alça. A linha muda de lugar assim que o ponteiro passa da
   * metade da vizinha. Os eventos são ouvidos na janela (do mesmo ponteiro):
   * mudar a linha de lugar no DOM solta a captura do ponteiro, e a alça
   * deixaria de recebê-los no meio do arraste.
   */
  startDrag(event: PointerEvent, key: string) {
    if (event.button !== 0) return;

    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const list = handle.closest<HTMLElement>('.CanelaSidebarCustomize-list');

    if (!list) return;

    const pointer = event.pointerId;

    handle.focus({ preventScroll: true });
    this.dragging = key;
    m.redraw.sync();

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointer) return;

      // A lista rola sozinha quando o ponteiro chega às bordas dela.
      const box = list.getBoundingClientRect();

      if (moveEvent.clientY < box.top + 24) list.scrollTop -= 8;
      else if (moveEvent.clientY > box.bottom - 24) list.scrollTop += 8;

      // O lugar novo: quantas das outras linhas têm o meio acima do ponteiro.
      let index = 0;

      list.querySelectorAll<HTMLElement>('.CanelaSidebarCustomize-row').forEach((row) => {
        if (row.dataset.key === key) return;

        const rect = row.getBoundingClientRect();

        if (moveEvent.clientY > rect.top + rect.height / 2) index++;
      });

      this.moveTo(key, index);
    };

    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointer) return;

      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      this.dragging = null;
      m.redraw();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /** O teclado na alça: ↑ e ↓ sobem e descem o item; Home e End o levam às pontas. */
  keyMove(event: KeyboardEvent, key: string) {
    const index = this.order.indexOf(key);
    const target = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: this.order.length - 1 }[event.key];

    if (target === undefined) return;

    event.preventDefault();
    this.moveTo(key, target);
  }

  save() {
    setCommunityMore(Array.from(this.hidden));

    // Quem só marcou e desmarcou não congela a ordem: ela continua a padrão
    // (e acompanha o tema). Grava se mudou ou se já havia uma escolhida.
    const moved = this.order.join('\n') !== this.attrs.entries.map((entry) => entry.key).join('\n');

    if (moved || getCommunityOrder().length) setCommunityOrder(this.order);

    this.attrs.onsave?.();
    this.hide();
  }

  reset() {
    setCommunityMore([]);
    setCommunityOrder([]);
    this.attrs.onsave?.();
    this.hide();
  }
}
