/*
 * O seletor de emoji do Discourse: busca no topo, a fileira de categorias,
 * a grade rolável com um título por categoria (os "Usados recentemente"
 * primeiro) e, embaixo, o emoji sob o mouse com o atalho dele e a escolha do
 * tom de pele.
 *
 * Abre como um balão preso ao botão da barra do editor, num contêiner no
 * <body>: dentro do composer ele seria cortado pela borda de cima.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import type { EmojiGroup, EmojiRow } from '../emoji-data';
import { TONES, getRecent, getTone, loadEmojiData, matches, normalize, pushRecent, setTone, twemojiUrl, usesTwemoji, withTone } from './emojiUtils';
import { t } from '../../../utils/settings';
import { FIXED_ARROW_GAP, attachFixedArrow } from '../../../shell/dropdownArrow';

/** Os ícones das categorias, na ordem do Discourse. */
const GROUP_ICONS: Record<string, string> = {
  recent: 'far fa-clock',
  smileys: 'far fa-face-smile',
  people: 'far fa-hand',
  nature: 'fas fa-leaf',
  food: 'fas fa-burger',
  activities: 'far fa-futbol',
  travel: 'fas fa-plane',
  objects: 'far fa-lightbulb',
  symbols: 'fas fa-icons',
  flags: 'far fa-flag',
};

/** Mais que isso numa busca vira ruído; o Discourse também corta. */
const SEARCH_LIMIT = 120;

export interface EmojiPickerAttrs extends ComponentAttrs {
  onselect: (emoji: string) => void;
  onclose: () => void;
}

export default class EmojiPicker extends Component<EmojiPickerAttrs> {
  private groups: EmojiGroup[] | null = null;
  private byChar = new Map<string, EmojiRow>();
  private query = '';
  private activeGroup = 'smileys';
  private tone = getTone();
  private toneOpen = false;
  private hovered: EmojiRow | null = null;
  private twemoji = usesTwemoji();

  oninit(vnode: Mithril.Vnode<EmojiPickerAttrs, this>) {
    super.oninit(vnode);

    loadEmojiData().then((groups) => {
      this.groups = groups;
      groups.forEach((group) => group.emoji.forEach((row) => this.byChar.set(row[0], row)));

      if (getRecent().length) this.activeGroup = 'recent';
      m.redraw();
    });
  }

  oncreate(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>) {
    super.oncreate(vnode);

    // No celular o teclado virtual cobriria metade do seletor: o foco na
    // busca fica só para quem tem mouse.
    if (app.screen() !== 'phone') (this.element.querySelector('.CanelaEmojiPicker-search input') as HTMLInputElement | null)?.focus();
  }

  view() {
    return (
      <div className="CanelaEmojiPicker" role="dialog" aria-label={t('composer.emoji.title')}>
        <div className="CanelaEmojiPicker-header">
          <div className="CanelaEmojiPicker-search">
            <Icon name="fas fa-magnifying-glass" />
            <input
              type="search"
              className="FormControl"
              placeholder={t('composer.emoji.search_placeholder')}
              value={this.query}
              oninput={(e: InputEvent) => {
                this.query = (e.target as HTMLInputElement).value;
                this.hovered = null;
              }}
              onkeydown={(e: KeyboardEvent) => this.onSearchKey(e)}
            />
          </div>
          <button
            type="button"
            className="Button Button--icon Button--link CanelaEmojiPicker-close"
            aria-label={t('composer.emoji.close')}
            onclick={() => this.attrs.onclose()}
          >
            <Icon name="fas fa-xmark" />
          </button>
        </div>

        {!this.query && this.groups && <nav className="CanelaEmojiPicker-groups">{this.groupButtons()}</nav>}

        <div className="CanelaEmojiPicker-body" onscroll={(e: Event) => this.trackScroll(e)}>
          {this.groups ? this.content() : <LoadingIndicator />}
        </div>

        <div className="CanelaEmojiPicker-footer">
          <div className="CanelaEmojiPicker-info">
            {this.hovered ? (
              <>
                {this.emojiImage(withTone(this.hovered, this.tone), 'CanelaEmojiPicker-infoEmoji')}
                <code>:{this.hovered[1].split(' ')[0]}:</code>
              </>
            ) : (
              <span className="CanelaEmojiPicker-hint">{t('composer.emoji.hint')}</span>
            )}
          </div>
          {this.toneSelector()}
        </div>
      </div>
    );
  }

  private groupButtons(): Mithril.Children {
    const keys = [...(getRecent().length ? ['recent'] : []), ...this.groups!.map((group) => group.key)];

    return keys.map((key) => (
      <button
        type="button"
        className={classList('CanelaEmojiPicker-group', { active: key === this.activeGroup })}
        title={t(`composer.emoji.groups.${key}`)}
        aria-label={t(`composer.emoji.groups.${key}`)}
        onclick={() => this.scrollTo(key)}
      >
        <Icon name={GROUP_ICONS[key] || 'far fa-face-smile'} />
      </button>
    ));
  }

  private content(): Mithril.Children {
    if (this.query.trim()) {
      const terms = normalize(this.query).split(/\s+/).filter(Boolean);
      const results: EmojiRow[] = [];

      for (const group of this.groups!) {
        for (const row of group.emoji) {
          if (matches(row, terms)) results.push(row);
          if (results.length >= SEARCH_LIMIT) break;
        }
        if (results.length >= SEARCH_LIMIT) break;
      }

      return results.length ? this.grid(results) : <p className="CanelaEmojiPicker-empty">{t('composer.emoji.no_results')}</p>;
    }

    const recent = getRecent()
      .map((char) => this.byChar.get(char))
      .filter((row): row is EmojiRow => !!row);

    // Sem `null` no lugar de "Recentes": as seções têm key, e o Mithril
    // recusa uma lista que mistura itens com e sem key.
    const sections = this.groups!.map((group) => this.section(group.key, group.emoji));

    return recent.length ? [this.section('recent', recent), ...sections] : sections;
  }

  private section(key: string, rows: EmojiRow[]): Mithril.Children {
    return (
      <section key={key} className="CanelaEmojiPicker-section" data-group={key}>
        <h4 className="CanelaEmojiPicker-sectionTitle">{t(`composer.emoji.groups.${key}`)}</h4>
        {this.grid(rows)}
      </section>
    );
  }

  private grid(rows: EmojiRow[]): Mithril.Children {
    return (
      <div className="CanelaEmojiPicker-grid">
        {rows.map((row) => {
          const emoji = withTone(row, this.tone);

          return (
            <button
              type="button"
              className="CanelaEmojiPicker-emoji"
              title={`:${row[1].split(' ')[0]}:`}
              onclick={() => this.select(row)}
              onmouseenter={() => (this.hovered = row)}
              onfocus={() => (this.hovered = row)}
            >
              {this.emojiImage(emoji)}
            </button>
          );
        })}
      </div>
    );
  }

  private emojiImage(emoji: string, className = ''): Mithril.Children {
    if (!this.twemoji) return <span className={classList('CanelaEmojiPicker-char', className)}>{emoji}</span>;

    return <img className={classList('emoji', className)} src={twemojiUrl(emoji)} alt={emoji} loading="lazy" draggable={false} />;
  }

  private toneSelector(): Mithril.Children {
    return (
      <div className={classList('CanelaEmojiPicker-tones', { open: this.toneOpen })}>
        {this.toneOpen ? (
          TONES.map((_, tone) => (
            <button
              type="button"
              className={classList('CanelaEmojiPicker-tone', `CanelaEmojiPicker-tone--${tone}`, { active: tone === this.tone })}
              aria-label={t(`composer.emoji.tones.${tone}`)}
              title={t(`composer.emoji.tones.${tone}`)}
              onclick={() => {
                this.tone = tone;
                this.toneOpen = false;
                setTone(tone);
              }}
            />
          ))
        ) : (
          <button
            type="button"
            className={classList('CanelaEmojiPicker-tone', `CanelaEmojiPicker-tone--${this.tone}`, 'active')}
            aria-label={t('composer.emoji.tone_label')}
            title={t('composer.emoji.tone_label')}
            onclick={() => (this.toneOpen = true)}
          />
        )}
      </div>
    );
  }

  private select(row: EmojiRow): void {
    pushRecent(row[0]);
    this.attrs.onselect(withTone(row, this.tone));
  }

  /** Enter na busca insere o primeiro resultado, como no Discourse. */
  private onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.attrs.onclose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      (this.element.querySelector('.CanelaEmojiPicker-emoji') as HTMLButtonElement | null)?.click();
    }
  }

  private scrollTo(key: string): void {
    const body = this.element.querySelector('.CanelaEmojiPicker-body') as HTMLElement | null;
    const section = this.element.querySelector(`.CanelaEmojiPicker-section[data-group="${key}"]`) as HTMLElement | null;

    if (!body || !section) return;

    body.scrollTop = section.offsetTop - body.offsetTop;
    this.activeGroup = key;
  }

  /** A categoria em destaque acompanha a rolagem da grade. */
  private trackScroll(e: Event): void {
    const body = this.element.querySelector('.CanelaEmojiPicker-body') as HTMLElement | null;

    if (!body) return;

    const sections = Array.from(body.querySelectorAll<HTMLElement>('.CanelaEmojiPicker-section'));
    const top = body.scrollTop + body.offsetTop + 8;
    const current = sections.filter((section) => section.offsetTop <= top).pop() || sections[0];
    const key = current?.dataset.group;

    // Rolar só redesenha quando a categoria muda: a grade tem 2 mil botões.
    if (key && key !== this.activeGroup) this.activeGroup = key;
    else (e as Event & { redraw?: boolean }).redraw = false;
  }
}

// ─── O balão ────────────────────────────────────────────────────────────────

let portal: HTMLElement | null = null;
let cleanup: (() => void) | null = null;
let arrow: { place: () => void; remove: () => void } | null = null;

export function closeEmojiPicker(): void {
  cleanup?.();
}

/**
 * Abre o seletor preso a `anchor` (o botão da barra). Fica acima do botão
 * quando há espaço — o editor está embaixo da tela — e nunca sai pela
 * lateral. No celular o CSS o transforma numa folha presa ao rodapé.
 */
export function openEmojiPicker(anchor: HTMLElement, onselect: (emoji: string) => void): void {
  if (cleanup) {
    cleanup();
    return;
  }

  portal = document.createElement('div');
  portal.className = 'CanelaEmojiPicker-portal';
  document.body.appendChild(portal);

  const position = () => {
    if (!portal || app.screen() === 'phone') return;

    const rect = anchor.getBoundingClientRect();
    const width = portal.offsetWidth;
    const height = portal.offsetHeight;
    const above = rect.top - height - FIXED_ARROW_GAP;

    portal.style.top = `${above >= 8 ? above : Math.min(rect.bottom + FIXED_ARROW_GAP, window.innerHeight - height - 8)}px`;
    portal.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    arrow?.place();
  };

  const close = () => {
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('resize', position);
    arrow?.remove();
    arrow = null;

    if (portal) {
      m.mount(portal, null);
      portal.remove();
    }

    portal = null;
    cleanup = null;
  };

  const outside = (e: MouseEvent) => {
    const target = e.target as Node;

    if (portal?.contains(target) || anchor.contains(target)) return;

    close();
  };

  cleanup = close;

  m.mount(portal, {
    view: () => (
      <EmojiPicker
        onselect={(emoji: string) => {
          close();
          onselect(emoji);
        }}
        onclose={close}
      />
    ),
  });

  // A setinha apontando para o botão do emoji. Ela encosta no rodapé do
  // balão (que tem fundo próprio), então copia a cor dele.
  arrow = attachFixedArrow(
    portal,
    anchor,
    portal.querySelector<HTMLElement>('.CanelaEmojiPicker-footer') ?? portal.querySelector<HTMLElement>('.CanelaEmojiPicker') ?? portal
  );
  position();
  // A primeira medida sai antes de a lista carregar; a altura do balão é
  // fixa no CSS, então uma segunda conta depois do desenho basta.
  requestAnimationFrame(position);

  document.addEventListener('mousedown', outside, true);
  window.addEventListener('resize', position);
}
