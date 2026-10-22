import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
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

/**
 * Quais itens da seção principal da barra lateral ficam à vista (os
 * desmarcados vão para dentro do "Mais") e em que ordem: as setas sobem e
 * descem cada item. As linhas têm `key`, então o foco acompanha o item que
 * mudou de lugar e dá para reordenar só com o teclado.
 */
export default class CommunityCustomizeModal extends Modal<CommunityCustomizeModalAttrs> {
  hidden = new Set<string>();
  order: string[] = [];

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
    const last = this.order.length - 1;

    return (
      <div className="Modal-body">
        <p className="helpText">{t('sidebar.customize_community_help')}</p>

        <ul className="CanelaSidebarCustomize-list">
          {this.order.map((key, index) => {
            const entry = byKey.get(key)!;

            return (
              <li key={key} className="CanelaSidebarCustomize-row">
                <label className="checkbox">
                  <input type="checkbox" checked={!this.hidden.has(key)} onchange={() => this.toggle(key)} />
                  {entry.icon && <Icon name={entry.icon} />}
                  <span>{entry.label}</span>
                </label>
                <span className="CanelaSidebarCustomize-move">
                  <Button
                    className="Button Button--icon Button--flat"
                    icon="fas fa-chevron-up"
                    aria-label={t('sidebar.customize_move_up', { item: entry.label })}
                    disabled={index === 0}
                    onclick={() => this.move(index, -1)}
                  />
                  <Button
                    className="Button Button--icon Button--flat"
                    icon="fas fa-chevron-down"
                    aria-label={t('sidebar.customize_move_down', { item: entry.label })}
                    disabled={index === last}
                    onclick={() => this.move(index, 1)}
                  />
                </span>
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

  /** Troca o item de lugar com o vizinho de cima (-1) ou de baixo (1). */
  move(index: number, step: -1 | 1) {
    const target = index + step;

    if (target < 0 || target >= this.order.length) return;

    [this.order[index], this.order[target]] = [this.order[target], this.order[index]];
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
