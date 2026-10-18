/*
 * Um menu de sugestões preso ao cursor do editor, como os do Discourse para
 * `:emoji` e `#categoria`.
 *
 * Segue o desenho do autocompletar do flarum/mentions (um contêiner logo
 * depois do textarea, posição calculada pelas coordenadas do cursor e as
 * setas/Enter/Tab/Esc pelo KeyboardNavigatable), mas como uma classe só,
 * reaproveitada pelos dois gatilhos do tema.
 */
import KeyboardNavigatable from 'flarum/common/utils/KeyboardNavigatable';
import AutocompleteReader from 'flarum/common/utils/AutocompleteReader';
import classList from 'flarum/common/utils/classList';
import type TextEditor from 'flarum/common/components/TextEditor';
import type Mithril from 'mithril';

import { editorDriver } from './common';

export interface Suggestion {
  key: string;
  /** O que aparece na linha do menu. */
  label: Mithril.Children;
  /** O texto que substitui o gatilho e o que foi digitado. */
  replacement: string;
}

export interface AutocompleteOptions {
  /** Classe extra do menu, para o CSS de cada gatilho. */
  className: string;
  trigger: string;
  /** Caracteres aceitos depois do gatilho (o resto encerra a sugestão). */
  validBit: RegExp;
  /** Quantos caracteres antes do cursor procurar o gatilho. */
  lookBehind?: number;
  /** Texto do cabeçalho do menu, quando há. */
  header?: () => string;
  /** As sugestões para o que foi digitado; pode ser assíncrono. */
  suggest: (typed: string) => Suggestion[] | Promise<Suggestion[]>;
}

export default class Autocomplete {
  active = false;
  private index = 0;
  private items: Suggestion[] = [];
  private start = 0;
  private container: HTMLElement | null = null;
  private textarea: HTMLElement | null = null;
  private request = 0;

  constructor(
    private readonly editor: TextEditor,
    private readonly options: AutocompleteOptions
  ) {}

  /** Chamado no `onbuild` do editor: o textarea já está no DOM. */
  attach(): void {
    const textarea = this.editor.element?.querySelector<HTMLElement>('.TextEditor-editor');

    if (!textarea || !textarea.parentElement) return;

    this.textarea = textarea;
    this.container = document.createElement('div');
    this.container.className = 'CanelaAutocomplete-container';
    textarea.parentElement.style.position ||= 'relative';
    textarea.after(this.container);

    new KeyboardNavigatable()
      .when(() => this.active && this.items.length > 0)
      .onUp(() => this.move(-1))
      .onDown(() => this.move(1))
      .onSelect(() => this.choose(this.index))
      .onCancel(() => this.hide())
      .bindTo($(textarea));
  }

  /** O ouvinte de digitação, posto em `params.inputListeners`. */
  readonly listener = (): void => {
    const driver = editorDriver(this.editor);

    if (!driver || !this.container) return;

    const [cursor, end] = driver.getSelectionRange();

    if (end - cursor > 0) return this.hide();

    const reader = new AutocompleteReader(this.options.trigger);
    const found = reader.check(driver.getLastNChars(this.options.lookBehind ?? 30), cursor, this.options.validBit);

    if (!found) return this.hide();

    this.start = found.absoluteStart;

    const request = ++this.request;

    Promise.resolve(this.options.suggest(found.typed)).then((items) => {
      // Uma resposta antiga (de uma busca na API) não pode passar por cima
      // do que já foi digitado depois.
      if (request !== this.request) return;

      this.items = items;
      this.index = 0;

      if (items.length) this.show();
      else this.hide();
    });
  };

  private show(): void {
    if (!this.container) return;

    this.active = true;
    this.render();

    const driver = editorDriver(this.editor);
    const menu = this.container.firstElementChild as HTMLElement | null;

    if (!driver || !menu) return;

    // Mesma conta do flarum/mentions: abaixo do cursor, ou acima quando não
    // cabe, e sem sair pela direita do editor. As coordenadas do cursor são
    // relativas ao textarea; o contêiner fica no canto do pai dele.
    const coordinates = driver.getCaretCoordinates(this.start);
    const parent = this.container.parentElement!;
    // Pelos retângulos, e não por offsetTop: o flarum/mentions pode embrulhar
    // o textarea num div posicionado depois que o contêiner foi criado.
    const textareaRect = this.textarea!.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    let top = textareaRect.top - parentRect.top + coordinates.top + 22;
    let left = textareaRect.left - parentRect.left + coordinates.left;

    if (top + menu.offsetHeight > parent.clientHeight) top = top - 22 - menu.offsetHeight - 6;
    if (left + menu.offsetWidth > parent.clientWidth) left = Math.max(0, parent.clientWidth - menu.offsetWidth);

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  hide(): void {
    this.request++;

    if (!this.active) return;

    this.active = false;
    this.items = [];

    if (this.container) m.render(this.container, null);
  }

  private move(delta: number): void {
    const count = this.items.length;

    this.index = (this.index + delta + count) % count;
    this.render();

    this.container?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  private choose(index: number): void {
    const item = this.items[index];
    const driver = editorDriver(this.editor);

    if (!item || !driver) return;

    // `start` é a posição logo depois do gatilho; o -1 o inclui na troca.
    driver.replaceBeforeCursor(this.start - 1, item.replacement + ' ', false);
    this.hide();
  }

  private render(): void {
    if (!this.container) return;

    const header = this.options.header?.();

    m.render(
      this.container,
      <ul className={classList('Dropdown-menu', 'CanelaAutocomplete', this.options.className)} role="listbox">
        {header && <li className="Dropdown-header">{header}</li>}
        {this.items.map((item, i) => (
          <li key={item.key} className={classList({ active: i === this.index })} role="option" aria-selected={i === this.index ? 'true' : 'false'}>
            <button
              type="button"
              // mousedown, e não click: o click tiraria o foco do textarea
              // antes, e o cursor iria para o fim do texto.
              onmousedown={(e: MouseEvent) => {
                e.preventDefault();
                this.choose(i);
              }}
              onmouseenter={() => {
                this.index = i;
                this.render();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }
}
