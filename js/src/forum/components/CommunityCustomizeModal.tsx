import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { getCommunityMore, setCommunityMore } from '../utils/sidebarPrefs';

export interface CommunityEntry {
  key: string;
  label: string;
  icon?: string;
}

export interface CommunityCustomizeModalAttrs extends IInternalModalAttrs {
  entries: CommunityEntry[];
  onsave?: () => void;
}

/**
 * Quais itens da seção principal da barra lateral ficam à vista; os
 * desmarcados vão para dentro do "Mais", como o "personalizar seção" do
 * Discourse.
 */
export default class CommunityCustomizeModal extends Modal<CommunityCustomizeModalAttrs> {
  hidden = new Set<string>();

  oninit(vnode: Mithril.Vnode<CommunityCustomizeModalAttrs, this>) {
    super.oninit(vnode);

    this.hidden = new Set(getCommunityMore());
  }

  className() {
    return 'CanelaSidebarCustomize Modal--small';
  }

  title() {
    return t('sidebar.customize_community');
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="helpText">{t('sidebar.customize_community_help')}</p>

        <ul className="CanelaSidebarCustomize-list">
          {this.attrs.entries.map((entry) => (
            <li>
              <label className="checkbox">
                <input type="checkbox" checked={!this.hidden.has(entry.key)} onchange={() => this.toggle(entry.key)} />
                {entry.icon && <Icon name={entry.icon} />}
                <span>{entry.label}</span>
              </label>
            </li>
          ))}
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

  save() {
    setCommunityMore(Array.from(this.hidden));
    this.attrs.onsave?.();
    this.hide();
  }

  reset() {
    setCommunityMore([]);
    this.attrs.onsave?.();
    this.hide();
  }
}
