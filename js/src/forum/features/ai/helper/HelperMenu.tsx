/*
 * O botão ✨ "Perguntar à IA" da barra do editor e o menu dele — o
 * ai-composer-helper-menu do Discourse.
 *
 * O menu abre logo acima do botão (com o fade e o leve deslize dos menus do
 * float-kit): prompt personalizado no topo, e as opções Traduzir, Revisar
 * texto (Ctrl+Alt+P), Simplificar, Explicar, Gerar tabela de Markdown,
 * Sugerir título e Sugerir categoria e etiquetas. Vale para o trecho
 * selecionado; sem seleção, para o texto todo.
 *
 * Título e etiquetas não abrem o modal de diff: as sugestões aparecem no
 * próprio menu, e um clique as aplica no composer.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type TextEditor from 'flarum/common/components/TextEditor';
import type ComposerState from 'flarum/forum/states/ComposerState';
import type Mithril from 'mithril';

import { isExtensionEnabled, t } from '../../../utils/settings';
import { aiRequest, showAiError } from '../state';
import { indicatorWave } from '../ui';
import { FIXED_ARROW_GAP, attachFixedArrow } from '../../../shell/dropdownArrow';
import { addTag, normalizeTags, removeTag, selectableTags } from '../../../composer/tagRules';

export interface HelperMenuAttrs extends ComponentAttrs {
  editor: TextEditor;
  /** O clique no botão provisório (index.tsx) chegou antes do chunk: já nasce aberto. */
  initiallyOpen?: boolean;
}

/** Abaixo disso não há o que sugerir de título (o MIN_CHARACTER_COUNT do Discourse). */
const MIN_TITLE_TEXT = 40;

type Panel = 'options' | 'titles' | 'tags';

interface Selection {
  start: number;
  end: number;
  text: string;
}

function languageName(): string {
  const locale = app.translator.getLocale() || 'pt-BR';

  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);

    return name ? name.charAt(0).toUpperCase() + name.slice(1) : locale;
  } catch {
    return locale;
  }
}

export default class HelperMenu extends Component<HelperMenuAttrs> {
  open = false;
  panel: Panel = 'options';
  customPrompt = '';
  loading = false;
  titles: string[] = [];
  tagIds: string[] = [];
  outsideListener = (event: Event) => this.onOutside(event);
  keyListener = (event: KeyboardEvent) => this.onKey(event);
  /** A setinha do menu aberto e o menu para o qual ela foi feita. */
  arrow: { menu: HTMLElement; place: () => void; remove: () => void } | null = null;

  composer(): ComposerState | null {
    return ((this.attrs.editor.attrs as any)?.composer as ComposerState) ?? null;
  }

  oninit(vnode: Mithril.Vnode<HelperMenuAttrs, this>) {
    super.oninit(vnode);
    if (this.attrs.initiallyOpen) this.toggle();
  }

  oncreate(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>) {
    super.oncreate(vnode);
    document.addEventListener('mousedown', this.outsideListener, true);
    document.addEventListener('keydown', this.keyListener);
    window.addEventListener('resize', this.placeListener);
    this.place();
  }

  onupdate(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>) {
    super.onupdate(vnode);
    this.place();
  }

  onremove(vnode: Mithril.VnodeDOM<HelperMenuAttrs, this>) {
    super.onremove(vnode);
    document.removeEventListener('mousedown', this.outsideListener, true);
    document.removeEventListener('keydown', this.keyListener);
    window.removeEventListener('resize', this.placeListener);
    this.dropArrow();
  }

  dropArrow(): void {
    this.arrow?.remove();
    this.arrow = null;
  }

  placeListener = () => this.place();

  /**
   * O menu fica fixo na janela, acima do botão e alinhado à direita dele. A
   * barra de formatação rola na horizontal (`overflow-x: auto`), e um menu
   * absoluto dentro dela era cortado: o clique abria um menu invisível.
   */
  place(): void {
    const trigger = this.element?.querySelector<HTMLElement>('.ai-helper-trigger');
    const menu = this.element?.querySelector<HTMLElement>('.CanelaAiHelper-menu');

    if (!trigger || !menu) {
      this.dropArrow();
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = menu.offsetWidth;
    const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.bottom = `${Math.round(window.innerHeight - rect.top + FIXED_ARROW_GAP)}px`;
    menu.style.maxHeight = `${Math.max(160, Math.round(rect.top - 2 * margin))}px`;

    // A setinha apontando para o ✨ (refeita se o menu foi desenhado de novo).
    if (this.arrow?.menu !== menu) {
      this.dropArrow();
      this.arrow = { menu, ...attachFixedArrow(menu, trigger) };
    } else {
      this.arrow.place();
    }
  }

  view() {
    return (
      <span className={classList('CanelaAiHelper', { 'is-open': this.open })}>
        <Button
          className="Button Button--icon Button--link ai-helper-trigger"
          icon="fas fa-wand-magic-sparkles"
          title={t('ai.helper.trigger')}
          aria-label={t('ai.helper.trigger')}
          aria-expanded={this.open ? 'true' : 'false'}
          onclick={() => this.toggle()}
        />
        {this.open && <div className="CanelaAiHelper-menu ai-composer-helper-menu">{this.panelView()}</div>}
      </span>
    );
  }

  panelView(): Mithril.Children {
    if (this.selection().text.trim() === '') {
      return (
        <div className="CanelaAiHelper-toast">
          <Icon name="fas fa-triangle-exclamation" /> {t('ai.helper.no_content_error')}
        </div>
      );
    }

    if (this.panel !== 'options') return this.suggestionsView();

    return (
      <ul className="ai-helper-options">
        <li>
          <form
            className="ai-custom-prompt"
            onsubmit={(event: Event) => {
              event.preventDefault();
              if (this.customPrompt.trim()) this.run('custom_prompt');
            }}
          >
            <div className="ai-custom-prompt__field">
              <input
                className="ai-custom-prompt__input"
                type="text"
                placeholder={t('ai.helper.custom_prompt_placeholder')}
                value={this.customPrompt}
                oninput={(event: InputEvent) => (this.customPrompt = (event.target as HTMLInputElement).value)}
              />
              <Button
                type="submit"
                className="Button Button--icon ai-custom-prompt__submit"
                icon="fas fa-paper-plane"
                disabled={!this.customPrompt.trim()}
                aria-label={t('ai.helper.custom_prompt_submit')}
              />
            </div>
          </form>
        </li>
        {this.options().map(([mode, icon, label, shortcut]) => (
          <li data-value={mode}>
            <Button className="Button ai-helper-options__button" icon={icon} onclick={() => this.run(mode)}>
              {label}
              {shortcut && <kbd className="shortcut">{shortcut}</kbd>}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  options(): [string, string, string, string?][] {
    const options: [string, string, string, string?][] = [
      ['translate', 'fas fa-language', t('ai.helper.translate', { language: languageName() })],
      ['proofread', 'fas fa-spell-check', t('ai.helper.proofread'), navigator.platform.includes('Mac') ? '⌘⌥P' : 'Ctrl+Alt+P'],
      ['simplify', 'fas fa-feather', t('ai.helper.simplify')],
      ['explain', 'far fa-circle-question', t('ai.helper.explain')],
      ['markdown_table', 'fas fa-table', t('ai.helper.markdown_table')],
    ];

    const composer = this.composer();
    const fields = (composer?.fields || {}) as any;
    const isNewTopic = !!composer && app.composer.bodyMatches('flarum/forum/components/DiscussionComposer');

    if (isNewTopic && typeof fields.title === 'function' && (fields.content?.() || '').length > MIN_TITLE_TEXT) {
      options.push(['titles', 'fas fa-heading', t('ai.helper.generate_titles')]);
    }

    if (isNewTopic && isExtensionEnabled('flarum-tags') && (fields.content?.() || '').trim()) {
      options.push(['tags', 'fas fa-tags', t('ai.helper.suggest_tags')]);
    }

    return options;
  }

  suggestionsView(): Mithril.Children {
    if (this.loading) {
      return (
        <div className="ai-suggestions-menu__loading">
          <Icon name="fas fa-spinner fa-spin" /> {indicatorWave()}
        </div>
      );
    }

    if (this.panel === 'titles') {
      if (!this.titles.length) return this.emptySuggestions();

      return (
        <ul className="ai-suggestions-menu CanelaAiHelper-suggestions">
          {this.titles.map((title) => (
            <li>
              <Button className="Button ai-helper-options__button" onclick={() => this.applyTitle(title)}>
                {title}
              </Button>
            </li>
          ))}
        </ul>
      );
    }

    const fields = (this.composer()?.fields || {}) as any;
    const chosen: any[] = fields.tags || [];
    // Só as sugestões que o flarum/tags deixaria escolher (permissão do ator).
    const selectable = selectableTags();
    const tags = this.tagIds.map((id) => app.store.getById<any>('tags', id)).filter((tag) => tag && selectable.includes(tag));

    if (!tags.length) return this.emptySuggestions();

    return (
      <ul className="ai-suggestions-menu CanelaAiHelper-suggestions">
        {tags.map((tag: any) => {
          const selected = chosen.includes(tag);
          // Fora das regras (máximo atingido): aparece, mas não dá para escolher.
          const blocked = !selected && !addTag(normalizeTags(chosen), tag, selectable);

          return (
            <li>
              <Button
                className={classList('Button ai-helper-options__button ai-tag-suggest-row', { 'is-selected': selected })}
                icon={selected ? 'fas fa-check' : tag.icon() || 'fas fa-tag'}
                disabled={blocked}
                onclick={() => this.toggleTag(tag)}
              >
                <span className="CanelaAiHelper-tagColor" style={{ background: tag.color() || undefined }} />
                {tag.name()}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  emptySuggestions(): Mithril.Children {
    return (
      <div className="ai-suggestions-menu__empty">
        <span className="ai-suggestions-menu__empty-text">{t('ai.helper.no_suggestions')}</span>
        <Button className="Button Button--text" icon="fas fa-rotate" onclick={() => this.run(this.panel)}>
          {t('ai.helper.regen')}
        </Button>
      </div>
    );
  }

  toggle(): void {
    this.open = !this.open;
    this.panel = 'options';
  }

  /** O trecho selecionado, ou o texto todo quando nada está selecionado. */
  selection(): Selection {
    const composer = this.composer();
    const content = String(composer?.fields?.content?.() || '');
    const range = composer?.editor?.getSelectionRange?.() || [0, 0];
    const [start, end] = range[0] !== range[1] ? [Math.min(range[0], range[1]), Math.max(range[0], range[1])] : [0, content.length];

    return { start, end, text: content.slice(start, end) };
  }

  run(mode: string): void {
    const composer = this.composer();
    const selection = this.selection();

    if (!composer || !selection.text.trim()) return;

    if (mode === 'titles' || mode === 'tags') {
      this.panel = mode;
      this.loading = true;

      const fields = composer.fields as any;

      aiRequest<{ data: { titles?: string[]; tagIds?: string[] } }>('POST', 'helper', {
        mode,
        text: String(fields.content?.() || ''),
        title: typeof fields.title === 'function' ? fields.title() : '',
      })
        .then((response) => {
          this.titles = response.data.titles || [];
          this.tagIds = response.data.tagIds || [];
        })
        .catch((error) => {
          showAiError(error);
          this.open = false;
        })
        .finally(() => {
          this.loading = false;
          m.redraw();
        });

      return;
    }

    this.open = false;

    const discussion = (composer.body?.attrs as any)?.discussion;

    app.modal.show(() => import('./DiffModal'), {
      mode,
      text: selection.text,
      language: languageName(),
      customPrompt: this.customPrompt,
      context: discussion?.title?.() || '',
      apply: (text: string) => {
        // Sem escapar: o texto novo é Markdown, como o que estava ali.
        composer.editor?.insertBetween(selection.start, selection.end, text, false);
        composer.editor?.focus();
      },
    });

    this.customPrompt = '';
  }

  applyTitle(title: string): void {
    const fields = this.composer()?.fields as any;

    if (typeof fields?.title === 'function') fields.title(title);

    this.open = false;
  }

  toggleTag(tag: any): void {
    const fields = this.composer()?.fields as any;

    if (!fields) return;

    // As regras do flarum/tags: tirar a primária leva as filhas; uma filha
    // entra com o pai; nada além dos máximos.
    const chosen: any[] = normalizeTags(fields.tags || []);
    const next = chosen.includes(tag) ? removeTag(chosen, tag) : addTag(chosen, tag);

    if (next) fields.tags = next;
  }

  onOutside(event: Event): void {
    if (this.open && this.element && !this.element.contains(event.target as Node)) {
      this.open = false;
      m.redraw();
    }
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      this.open = false;
      m.redraw();
      return;
    }

    // Ctrl+Alt+P (⌘⌥P no Mac): revisar o texto, sem abrir o menu, como no Discourse.
    const editorElement = this.attrs.editor.element as HTMLElement | undefined;

    if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === 'KeyP' && editorElement?.contains(document.activeElement)) {
      event.preventDefault();
      this.run('proofread');
    }
  }
}
