/*
 * O `select-kit` do Discourse, no tamanho do que o composer precisa: um
 * cabeçalho que abre, logo embaixo (ou em cima, quando falta espaço), o
 * corpo com o campo "Pesquisar…" e a lista. Setas sobem e descem, Enter
 * escolhe, Esc fecha; clicar fora fecha.
 *
 * Quem usa passa as linhas já filtradas (`rows(filter)`), o conteúdo do
 * cabeçalho e o que fazer ao escolher — o componente só cuida de abrir,
 * posicionar e navegar.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

export interface SelectKitRow {
  key: string;
  content: Mithril.Children;
  selected?: boolean;
  title?: string;
}

export interface SelectKitAttrs extends ComponentAttrs {
  className?: string;
  header: Mithril.Children;
  /** Ícone à direita do cabeçalho (seta, "+"). */
  caret?: string;
  /** Ícone à direita com o menu aberto. */
  caretOpen?: string;
  rows: (filter: string) => SelectKitRow[];
  onselect: (key: string) => void;
  /** Continua aberto depois de escolher (o seletor de etiquetas). */
  stayOpen?: boolean;
  disabled?: boolean;
  label: string;
  /** A lupa à direita do campo de busca (o de categoria tem; o de etiquetas, não). */
  filterIcon?: boolean;
  /** O que vem entre a busca e a lista (as etiquetas já escolhidas). */
  before?: Mithril.Children;
  /** O que vem depois da lista (o "Filtre para ver mais…" da barra da lista). */
  after?: Mithril.Children | ((filter: string) => Mithril.Children);
  /** Texto do campo de busca (padrão: "Pesquisar…"). */
  placeholder?: string;
  /**
   * Ao abrir, destaca a linha escolhida (ou nenhuma), em vez da primeira —
   * o `category-drop` do Discourse abre sem destacar nada.
   */
  highlightSelected?: boolean;
  emptyText?: string;
}

const BODY_MIN_SPACE = 300;

export default class SelectKit extends Component<SelectKitAttrs> {
  open = false;
  filter = '';
  highlighted = 0;
  above = false;
  private outside: ((e: MouseEvent) => void) | null = null;

  view(): Mithril.Children {
    const { className, header, caret = 'fas fa-angle-down', caretOpen = 'fas fa-angle-up', disabled, label } = this.attrs;

    return (
      <div className={classList('CanelaSelectKit', className, { 'is-expanded': this.open, 'is-above': this.above, 'is-disabled': disabled })}>
        <button
          type="button"
          className="CanelaSelectKit-header"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={this.open ? 'true' : 'false'}
          aria-label={label}
          onclick={() => (this.open ? this.close() : this.show())}
          onkeydown={(e: KeyboardEvent) => {
            if (!this.open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              this.show();
            }
          }}
        >
          <span className="CanelaSelectKit-headerContent">{header}</span>
          <Icon name={this.open ? caretOpen : caret} className="CanelaSelectKit-caret" />
        </button>
        {this.open && this.bodyView()}
      </div>
    );
  }

  bodyView(): Mithril.Children {
    const rows = this.attrs.rows(this.filter);

    if (this.highlighted >= rows.length) this.highlighted = rows.length - 1;

    const filter = (
      <div className="CanelaSelectKit-filter">
        <input
          type="search"
          className="CanelaSelectKit-filterInput"
          placeholder={this.attrs.placeholder || t('composer.shell.search_placeholder')}
          value={this.filter}
          autocomplete="off"
          spellcheck={false}
          oninput={(e: InputEvent) => {
            this.filter = (e.target as HTMLInputElement).value;
            this.highlighted = 0;
          }}
          onkeydown={(e: KeyboardEvent) => this.onkeydown(e, rows)}
          oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus()}
        />
        {this.attrs.filterIcon && <Icon name="fas fa-magnifying-glass" className="CanelaSelectKit-filterIcon" />}
      </div>
    );

    const list = (
      <ul className="CanelaSelectKit-collection" role="listbox" aria-label={this.attrs.label}>
        {rows.length ? (
          rows.map((row, i) => (
            <li
              key={row.key}
              className={classList('CanelaSelectKit-row', { 'is-highlighted': i === this.highlighted, 'is-selected': row.selected })}
              role="option"
              aria-selected={row.selected ? 'true' : 'false'}
              title={row.title}
              onmouseenter={() => (this.highlighted = i)}
              // `mousedown` e não `click`: escolher antes que o campo perca o foco.
              onmousedown={(e: MouseEvent) => {
                e.preventDefault();
                this.choose(row.key);
              }}
            >
              {row.content}
            </li>
          ))
        ) : (
          <li key="empty" className="CanelaSelectKit-empty">
            {this.attrs.emptyText || t('composer.shell.no_results')}
          </li>
        )}
      </ul>
    );

    const after = typeof this.attrs.after === 'function' ? this.attrs.after(this.filter) : this.attrs.after;

    // Aberto para cima, a busca fica embaixo, perto do cabeçalho (como no Discourse).
    return (
      <div className="CanelaSelectKit-body" onmousedown={(e: MouseEvent) => e.stopPropagation()}>
        {this.above ? [after, list, this.attrs.before, filter] : [filter, this.attrs.before, list, after]}
      </div>
    );
  }

  onkeydown(e: KeyboardEvent, rows: SelectKitRow[]): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlighted = Math.min(rows.length - 1, this.highlighted + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlighted = Math.max(0, this.highlighted - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[this.highlighted];
      if (row) this.choose(row.key);
    } else if (e.key === 'Escape') {
      // Não deixa o Esc chegar ao composer (que fecharia tudo).
      e.preventDefault();
      e.stopPropagation();
      this.close();
      (this.element.querySelector('.CanelaSelectKit-header') as HTMLElement | null)?.focus();
    } else if (e.key === 'Tab') {
      this.close();
    }

    this.scrollHighlightedIntoView();
  }

  scrollHighlightedIntoView(): void {
    requestAnimationFrame(() => {
      (this.element?.querySelector('.CanelaSelectKit-row.is-highlighted') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
    });
  }

  choose(key: string): void {
    this.attrs.onselect(key);
    this.filter = '';

    if (!this.attrs.stayOpen) this.close();
    m.redraw();
  }

  show(): void {
    if (this.attrs.disabled) return;

    // Abre para cima quando falta espaço embaixo e sobra em cima.
    const rect = this.element.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    this.above = below < BODY_MIN_SPACE && rect.top > below;

    this.open = true;
    this.filter = '';
    this.highlighted = this.attrs.highlightSelected ? this.attrs.rows('').findIndex((row) => row.selected) : 0;

    this.outside = (e: MouseEvent) => {
      if (!this.element.contains(e.target as Node)) {
        this.close();
        m.redraw();
      }
    };
    document.addEventListener('mousedown', this.outside);
  }

  close(): void {
    this.open = false;

    if (this.outside) document.removeEventListener('mousedown', this.outside);
    this.outside = null;
  }

  onremove(vnode: Mithril.VnodeDOM<SelectKitAttrs, this>): void {
    super.onremove(vnode);
    this.close();
  }
}
