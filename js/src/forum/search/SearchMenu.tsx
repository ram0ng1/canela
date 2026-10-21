/*
 * O menu de busca (`.search-menu`): o próprio campo do cabeçalho
 * é o campo da busca, e o painel (`.search-menu-panel`) abre colado embaixo
 * dele, sem modal e sem escurecer a página.
 *
 * - Vazio: uma dica aleatória ("#", "@", "é:", Ctrl+Enter) e as buscas
 *   recentes; numa página de categoria, "em ▪ Categoria".
 * - Digitando: "termo em todos os tópicos e postagens ou pressione Enter",
 *   seguido das categorias, etiquetas e usuários que casam com o termo.
 * - "#", "@" ou "chave:" no fim do termo: o assistente com as sugestões.
 * - Enter: os tópicos, com o ícone de estado, o título, a categoria e o
 *   trecho com o termo em negrito; Enter de novo (ou Ctrl+Enter) abre a
 *   busca de página inteira.
 *
 * No celular o cabeçalho mostra só a lupa; tocada, o campo cobre o cabeçalho
 * e o painel ocupa a tela abaixo dele.
 *
 * Os nomes de classe são genéricos (`search-menu`, `search-menu-panel`…); o CSS (less/forum/Search.less) vale só dentro de
 * `.CanelaSearchMenu`, para não colidir com as classes genéricas.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { searchIcon, slidersIcon } from '../utils/shellIcons';
import { aiUsable } from '../features/ai/state';
import state from './state';
import { advancedSearchAvailable, fullSearchUrl } from './query';
import { preloadSearchPanel, SearchPanelSlot } from './panelLazy';

export interface SearchMenuAttrs extends ComponentAttrs {
  /** `header` (o campo do cabeçalho) ou `welcome` (o banner de boas-vindas). */
  location: 'header' | 'welcome';
}

/** Duas vezes Enter em até 15s abre a busca de página inteira (`SECOND_ENTER_MAX_DELAY`). */
const SECOND_ENTER_MAX_DELAY = 15000;

let instances = 0;

export function aiAvailable(): boolean {
  return aiUsable('search') && 'canela.ai.conversations' in (app.routes as Record<string, unknown>);
}

export default class SearchMenu extends Component<SearchMenuAttrs> {
  protected open = false;
  protected lastEnter = 0;
  protected inputId = '';

  protected onDocumentPress = (event: Event) => {
    if (!this.open) return;

    const target = event.target as HTMLElement | null;

    if (target && this.element?.contains(target)) return;

    this.close(false);
  };

  oninit(vnode: Mithril.Vnode<SearchMenuAttrs, this>) {
    super.oninit(vnode);

    // O primeiro menu usa o id `search-term`; o do banner, outro.
    this.inputId = instances++ === 0 ? 'search-term' : `search-term-${instances}`;

    // Depois de uma busca na lista (`/?q=`), o campo continua mostrando o termo.
    const active = app.search.state.getValue?.();

    if (active && !state.term) state.term = active;
  }

  oncreate(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>) {
    super.oncreate(vnode);

    // O painel (resultados, dicas, assistente) é um chunk: desce antes do
    // primeiro foco — no hover/toque do campo ou, sem isso, no ocioso do boot.
    this.element.addEventListener('mouseenter', preloadSearchPanel, { once: true });
    this.element.addEventListener('touchstart', preloadSearchPanel, { once: true, passive: true });
    this.element.addEventListener('focusin', preloadSearchPanel, { once: true });
    preloadSearchPanel({ idle: true });

    document.addEventListener('mousedown', this.onDocumentPress);
    document.addEventListener('touchend', this.onDocumentPress);
  }

  onremove(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>) {
    super.onremove(vnode);

    document.removeEventListener('mousedown', this.onDocumentPress);
    document.removeEventListener('touchend', this.onDocumentPress);
  }

  view(): Mithril.Children {
    const location = this.attrs.location;

    return (
      <div
        className={classList('search-menu glimmer-search-menu CanelaSearchMenu', `CanelaSearchMenu--${location}`, {
          'CanelaSearchMenu--open': this.open,
        })}
        role="search"
        onkeydown={(event: KeyboardEvent) => this.onKeydown(event)}
      >
        {location === 'header' && (
          <button
            type="button"
            className="CanelaSearchMenu-toggle CanelaHeaderSearch Button Button--icon Button--flat"
            aria-label={t('search_menu.title')}
            title={t('search_menu.title')}
            onclick={() => (this.open ? this.close() : this.openAndFocus())}
          >
            {searchIcon()}
          </button>
        )}
        <div className={classList('search-menu-container menu-panel-results', { loading: state.loading })}>
          {this.inputView()}
          {this.open && <SearchPanelSlot menu={this} />}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Campo
  // ---------------------------------------------------------------------

  placeholder(): string {
    // Com a IA, o campo diz "Pesquisar ou perguntar à IA".
    return aiAvailable() ? t('ai.search.placeholder') : t('search_menu.title');
  }

  inputView(): Mithril.Children {
    const placeholder = this.placeholder();

    return (
      <div className="search-input-wrapper">
        <div
          className={classList('search-input', `search-input--${this.attrs.location}`, 'CanelaHeaderSearch')}
          onclick={(event: MouseEvent) => {
            // O atalho "/" e quem clica fora do texto (na lupa) caem no campo.
            if (!(event.target as HTMLElement).closest('a, button, input')) this.input()?.focus();
          }}
        >
          <span className="search-icon" aria-hidden="true">
            {searchIcon()}
          </span>
          <input
            id={this.inputId}
            className="search-term__input"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            aria-label={placeholder}
            placeholder={placeholder}
            value={state.term}
            oninput={(event: InputEvent) => state.setTerm((event.target as HTMLInputElement).value)}
            onkeydown={(event: KeyboardEvent) => this.onInputKeydown(event)}
            onfocus={() => this.openMenu()}
          />
          <div className="searching">
            {state.loading ? (
              <div className="spinner small" />
            ) : (
              [
                state.term ? (
                  <a
                    href="#"
                    className="clear-search"
                    aria-label={t('search_menu.clear_search')}
                    title={t('search_menu.clear_search')}
                    onclick={(event: MouseEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      state.clear();
                      this.input()?.focus();
                    }}
                  >
                    <Icon name="fas fa-times" />
                  </a>
                ) : null,
                advancedSearchAvailable() ? (
                  <button
                    type="button"
                    className="show-advanced-search btn-transparent"
                    title={t('search_menu.open_advanced')}
                    aria-label={t('search_menu.open_advanced')}
                    onclick={() => this.go(fullSearchUrl(state.term))}
                  >
                    {slidersIcon()}
                  </button>
                ) : null,
              ]
            )}
          </div>
          {/* No celular o campo cobre o cabeçalho: este X o fecha. */}
          <button type="button" className="CanelaSearchMenu-cancel" aria-label={t('search_menu.close')} onclick={() => this.close()}>
            <Icon name="fas fa-times" />
          </button>
        </div>
      </div>
    );
  }

  input(): HTMLInputElement | null {
    return (this.element?.querySelector('input.search-term__input') as HTMLInputElement | null) || null;
  }

  openMenu(): void {
    if (this.open) return;

    this.open = true;
    m.redraw();
  }

  /** O toque na lupa do celular: o campo precisa existir na tela antes do foco (o teclado só abre dentro do gesto). */
  openAndFocus(): void {
    this.open = true;
    m.redraw.sync();
    this.input()?.focus();
  }

  close(blur = true): void {
    this.open = false;

    // Sem o foco, focar de novo reabre o painel.
    if (blur) this.input()?.blur();

    m.redraw();
  }

  go(url: string): void {
    this.close();
    m.route.set(url);
  }

  fullSearch(): void {
    this.go(fullSearchUrl(state.term));
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return;

    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      this.fullSearch();
      return;
    }

    this.openMenu();

    const recentEnter = this.lastEnter && Date.now() - this.lastEnter < SECOND_ENTER_MAX_DELAY;

    if (state.searchTopics && recentEnter) {
      this.fullSearch();
    } else if (state.term.trim()) {
      state.searchTopicsNow();
    }

    this.lastEnter = Date.now();
  }

  /** Esc fecha; as setas andam pelos links do painel e voltam ao campo. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!this.open || !this.element) return;

    const input = this.input();
    const links = Array.from(
      this.element.querySelectorAll<HTMLElement>('.search-menu-panel .search-link, .search-menu-panel .clear-recent-searches')
    );
    const items: HTMLElement[] = input ? [input, ...links] : links;

    if (items.length < 2) return;

    event.preventDefault();

    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);

    items[next].focus();
  }
}
