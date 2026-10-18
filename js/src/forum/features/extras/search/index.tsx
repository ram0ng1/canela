/*
 * Página de busca avançada: gambits próprios e o link "Busca avançada →" no
 * modal de busca do core. A rota em si é registrada em ../extend.ts.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import installGambits from '../gambits';
import { searchPageEnabled, searchUrl } from './route';

export default function installSearchPage(): void {
  installGambits();

  // O SearchModal é carregado sob demanda (chunk); o extend por caminho só
  // é aplicado quando o módulo chega.
  extend('flarum/common/components/SearchModal', 'activeTabItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!searchPageEnabled()) return;

    // O modal também serve o admin; a página só existe no fórum.
    if (!app.route || !('canela.search' in app.routes)) return;

    const source = this.activeSource?.();
    const query = String(this.query?.() || '');
    const type = source?.resource === 'posts' ? 'posts' : source?.resource === 'users' ? 'users' : undefined;

    items.add(
      'canelaAdvancedSearch',
      <div className="SearchModal-section CanelaSearchModal-advanced">
        <hr className="Modal-divider" />
        <ul className="Dropdown-menu SearchModal-fullPage">
          <li>
            <LinkButton icon="fas fa-sliders" href={searchUrl(query.trim(), type)}>
              {t('extras.search.modal_link')}
            </LinkButton>
          </li>
        </ul>
      </div>,
      // Logo abaixo do "pesquisar todas as discussões" do core (80).
      75
    );
  });
}
