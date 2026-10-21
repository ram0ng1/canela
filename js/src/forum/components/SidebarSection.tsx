import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

export interface SidebarSectionAttrs extends ComponentAttrs {
  /** Chave da seção, usada para lembrar se o leitor a recolheu. */
  name: string;
  /** Sem título, a seção não recolhe — é a seção da comunidade, no topo. */
  title?: Mithril.Children;
  /** O lápis de "personalizar seção", que aparece ao passar o mouse no cabeçalho. */
  onEdit?: () => void;
  editLabel?: string;
  /** O ícone do botão do cabeçalho; o padrão é o lápis (o "+" das mensagens diretas do chat é outro). */
  editIcon?: string;
}

const STORAGE_PREFIX = 'canela.sidebarSection.';

function readCollapsed(name: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + name) === '1';
  } catch {
    return false;
  }
}

/**
 * Seção da barra lateral, com o cabeçalho em versalete e a seta que a recolhe —
 * como as "Categorias" e as "Etiquetas".
 */
export default class SidebarSection extends Component<SidebarSectionAttrs> {
  collapsed = false;

  oninit(vnode: Mithril.Vnode<SidebarSectionAttrs, this>) {
    super.oninit(vnode);

    this.collapsed = !!this.attrs.title && readCollapsed(this.attrs.name);
  }

  view(vnode: Mithril.Vnode<SidebarSectionAttrs, this>) {
    const { name, title, onEdit, editLabel, editIcon } = this.attrs;
    const contentId = `canela-sidebar-section-${name}`;

    return (
      <section className={classList('CanelaSidebar-section', `CanelaSidebar-section--${name}`, { collapsed: this.collapsed })}>
        {title && (
          <div className="CanelaSidebar-sectionHead">
            <button
              type="button"
              className="CanelaSidebar-sectionHeader"
              aria-expanded={this.collapsed ? 'false' : 'true'}
              aria-controls={contentId}
              onclick={() => this.toggle()}
            >
              <Icon name="fas fa-angle-down" className="CanelaSidebar-sectionCaret" />
              <span className="CanelaSidebar-sectionTitle">{title}</span>
            </button>
            {onEdit && (
              <button type="button" className="CanelaSidebar-sectionEdit" aria-label={editLabel} title={editLabel} onclick={onEdit}>
                <Icon name={editIcon || 'fas fa-pencil'} />
              </button>
            )}
          </div>
        )}
        {!this.collapsed && (
          <ul className="CanelaSidebar-sectionContent" id={contentId}>
            {vnode.children}
          </ul>
        )}
      </section>
    );
  }

  toggle() {
    this.collapsed = !this.collapsed;

    try {
      localStorage.setItem(STORAGE_PREFIX + this.attrs.name, this.collapsed ? '1' : '0');
    } catch {
      // Sem armazenamento a escolha vale só até recarregar a página.
    }
  }
}
