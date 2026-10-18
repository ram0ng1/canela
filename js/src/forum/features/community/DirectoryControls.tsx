import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Select from 'flarum/common/components/Select';
import type Mithril from 'mithril';

import type DirectoryState from './DirectoryState';
import { PERIODS, type PeriodKey } from './api';
import { t } from '../../utils/settings';

const SEARCH_DELAY_MS = 350;

export interface DirectoryControlsAttrs extends ComponentAttrs {
  state: DirectoryState;
}

/** Período, busca por nome e o total: a barra acima da tabela do diretório. */
export default class DirectoryControls extends Component<DirectoryControlsAttrs> {
  searchTimer: ReturnType<typeof setTimeout> | undefined;
  draft: string | null = null;

  onremove(vnode: Mithril.VnodeDOM<DirectoryControlsAttrs, this>) {
    super.onremove(vnode);
    clearTimeout(this.searchTimer);
  }

  view(): Mithril.Children {
    const { state } = this.attrs;
    const options = Object.fromEntries(PERIODS.map((period) => [period, t(`community.users.period.${period}`)]));

    return (
      <div className="CanelaDirectory-controls">
        <div className="CanelaDirectory-filters">
          <Select
            className="CanelaDirectory-period"
            options={options}
            value={state.params.period || 'all'}
            onchange={(value: PeriodKey) => state.setPeriod(value)}
            aria-label={t('community.users.period_label')}
          />
          <label className="CanelaDirectory-search">
            <Icon name="fas fa-magnifying-glass" />
            <input
              className="FormControl"
              type="search"
              placeholder={t('community.users.search_placeholder')}
              aria-label={t('community.users.search_placeholder')}
              value={this.draft ?? state.params.q ?? ''}
              oninput={(event: InputEvent) => this.search((event.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        {state.total !== null && <span className="CanelaDirectory-total">{t('community.users.total', { count: state.total })}</span>}
      </div>
    );
  }

  /** A busca espera a pessoa parar de digitar: uma requisição por nome, não por tecla. */
  search(value: string): void {
    this.draft = value;
    clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => {
      this.draft = null;
      this.attrs.state.refresh({ q: value.trim() });
    }, SEARCH_DELAY_MS);
  }
}
