import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Select from 'flarum/common/components/Select';
import Switch from 'flarum/common/components/Switch';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { TRUST_LEVEL_NAMES, trustLevel, trustLevelName } from '../utils';
import { t } from '../../../utils/settings';

export interface TrustLevelModalAttrs extends IFormModalAttrs {
  user: User;
}

/**
 * Alterar o nível de confiança à mão (só admin) — o único caminho para o 4,
 * Líder. Escolher um nível já o fixa (o servidor faz isso); o interruptor
 * deixa soltar de novo, para o sistema voltar a promover e rebaixar.
 */
export default class TrustLevelModal extends FormModal<TrustLevelModalAttrs> {
  level = 0;
  locked = false;

  oninit(vnode: Mithril.Vnode<TrustLevelModalAttrs, this>) {
    super.oninit(vnode);

    this.level = trustLevel(this.attrs.user) ?? 0;
    this.locked = !!this.attrs.user.attribute<boolean>('trustLevelLocked');
  }

  className() {
    return 'CanelaTrustLevelModal Modal--small';
  }

  title() {
    return t('badges.trust_level_modal.title', { username: this.attrs.user.displayName() });
  }

  content() {
    const options = Object.fromEntries(TRUST_LEVEL_NAMES.map((_, level) => [String(level), `${level}: ${trustLevelName(level)}`]));

    return (
      <div className="Modal-body">
        <div className="Form">
          <div className="Form-group">
            <label>{t('badges.trust_level_modal.level_label')}</label>
            <Select options={options} value={String(this.level)} onchange={(value: string) => (this.level = Number(value))} />
          </div>
          <div className="Form-group">
            <Switch state={this.locked} onchange={(value: boolean) => (this.locked = value)}>
              {t('badges.trust_level_modal.locked_label')}
            </Switch>
            <p className="helpText">{t(this.locked ? 'badges.trust_level_modal.locked_help' : 'badges.trust_level_modal.unlocked_help')}</p>
          </div>
          <div className="Form-group">
            <Button className="Button Button--primary Button--block" type="submit" loading={this.loading}>
              {t('badges.trust_level_modal.submit')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    this.loading = true;

    // O nível vai antes do bloqueio: o servidor fixa o nível escolhido à mão,
    // e o valor do interruptor, que vem depois, é a palavra final.
    const data: Record<string, unknown> = { trustLevelLocked: this.locked };

    if (this.level !== trustLevel(this.attrs.user)) data.trustLevel = this.level;

    this.attrs.user
      .save(data, { errorHandler: this.onerror.bind(this) })
      .then(() => this.hide())
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
