import Component from 'flarum/common/Component';

import { t } from '../utils/settings';
import { menuIcon } from '../utils/shellIcons';
import { isSidebarOpen, toggleSidebar } from '../utils/sidebarState';

/**
 * O hambúrguer do Discourse: à esquerda do logo no tablet e no desktop, onde
 * abre e fecha a barra encaixada, e à direita no celular, onde abre o painel.
 */
export default class HeaderToggle extends Component {
  view() {
    const open = isSidebarOpen();

    return (
      <button
        type="button"
        className="CanelaHeader-toggle Button Button--icon Button--flat"
        aria-label={t('sidebar.toggle')}
        title={t('sidebar.toggle')}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="canela-sidebar"
        onclick={() => toggleSidebar()}
      >
        {menuIcon()}
      </button>
    );
  }
}
