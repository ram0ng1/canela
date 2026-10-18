/*
 * "Pesquisar ou perguntar à IA" (o "Search or Ask AI" do Meta): o campo de
 * busca do cabeçalho muda de texto, e o modal de busca ganha, no topo dos
 * resultados, a linha "Perguntar à IA: <consulta>" — que abre a página de
 * conversas com a pergunta já enviada.
 *
 * O GlobalSearch é do bundle principal; o SearchModal é carregado sob demanda,
 * daí o extend pelo nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import GlobalSearch from 'flarum/forum/components/GlobalSearch';
import Icon from 'flarum/common/components/Icon';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { aiUsable } from './state';
import { askAi } from './bot/routes';

export default function installAskAi(): void {
  override(GlobalSearch as any, 'initAttrs', function (original: (attrs: any) => void, attrs: any) {
    original(attrs);

    if (aiUsable('search')) attrs.label = t('ai.search.placeholder');
  });

  extend('flarum/common/components/SearchModal', 'activeTabItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!aiUsable('search') || !app.route || !('canela.ai.conversations' in app.routes)) return;

    const query = String(this.query?.() || '').trim();

    if (query.length < 2) return;

    items.add(
      'canelaAskAi',
      <div className="SearchModal-section CanelaAskAi">
        <ul className="Dropdown-menu CanelaAskAi-menu">
          <li>
            <button
              type="button"
              className="Button Button--link CanelaAskAi-button"
              onclick={() => {
                app.modal.close();
                askAi(query);
              }}
            >
              <Icon name="fas fa-wand-magic-sparkles" className="CanelaAskAi-icon" />
              <span className="CanelaAskAi-label">
                <span className="CanelaAskAi-prefix">{t('ai.search.ask_prefix')}</span> <span className="CanelaAskAi-query">{query}</span>
              </span>
              <span className="CanelaAskAi-badge">{t('ai.search.badge')}</span>
            </button>
          </li>
        </ul>
      </div>,
      // Acima de tudo, como o "Ask AI" no topo do menu de busca do Meta.
      110
    );
  });

  const placeholder = function (this: any) {
    if (!aiUsable('search')) return;

    const input = this.element?.querySelector?.('.SearchModal-input') as HTMLInputElement | null;
    const label = t('ai.search.placeholder');

    if (input && input.placeholder !== label) input.placeholder = label;
  };

  extend('flarum/common/components/SearchModal', 'oncreate', placeholder);
  extend('flarum/common/components/SearchModal', 'onupdate', placeholder);
}
