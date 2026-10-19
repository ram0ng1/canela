/*
 * A barra de formatação do composer do Discourse (`.d-editor-button-bar`):
 *
 *   [M↓|A]  N  I  Tт  🔗  "  <>  ⬆  ☰  1.  ⇆  ☺  ⊕   ›
 *
 * - O alternador Markdown/"A" (o `composer-toggle-switch`): Markdown abre o
 *   composer na largura toda com a prévia ao lado; "A" o deixa estreito, sem
 *   a prévia (veja `richMode`).
 * - Negrito e título como letras ("N", "Tт"), aspas de fechamento.
 * - O ⬆ é o upload do fof/upload (que o põe no rodapé), trazido para depois
 *   do código; arrastar e colar imagens continua sendo dele.
 * - ⇆ alterna a direção do texto (`toggle-direction`).
 * - O ⊕ (`options`) junta o que o Discourse não mostra na barra: tachado,
 *   spoiler, imagem por endereço, menção e a enquete do fof/polls.
 * - "›" aparece quando a barra não cabe e a rola.
 *
 * Tudo entra no primeiro editor, depois das extensões: o flarum/markdown monta
 * a barra por `override`, e um `extend` registrado antes seria descartado.
 * Vale para qualquer TextEditor com composer (o de mensagens também).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import TextEditor from 'flarum/common/components/TextEditor';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import extractText from 'flarum/common/utils/extractText';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { editorComposer } from '../features/composer/common';
import { t } from '../utils/settings';
import { morphComposer } from './morph';

export interface MoreAction {
  icon: string;
  label: string;
  onclick: (e?: MouseEvent) => void;
  active?: boolean;
}

const MODE_KEY = 'canela.composerEditor';
let memoryMode: 'rich' | 'markdown' = 'rich';

/**
 * Os dois modos do alternador "M↓ | A" do Discourse, lembrados no navegador:
 * - "A" (padrão): o composer estreito, da largura do tópico, sem a prévia ao
 *   lado e só com tela cheia/minimizar/fechar no canto. O Flarum não tem
 *   editor rico; o texto continua sendo escrito no mesmo campo.
 * - Markdown: a largura toda, a prévia ao lado (o « no canto a esconde).
 */
export function richMode(): boolean {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === null ? true : value === 'rich';
  } catch {
    return memoryMode === 'rich';
  }
}

/** O placeholder do campo conforme o modo, para trocar sem reabrir. */
let placeholderFor: (rich: boolean) => string = () => '';

export function setPlaceholderProvider(provider: (rich: boolean) => string): void {
  placeholderFor = provider;
}

export function setRichMode(value: boolean): void {
  memoryMode = value ? 'rich' : 'markdown';

  try {
    localStorage.setItem(MODE_KEY, memoryMode);
  } catch {
    // Vale até sair da página.
  }

  const textarea = document.querySelector('.Composer .TextEditor-editor') as HTMLTextAreaElement | null;
  const placeholder = placeholderFor(value);
  if (textarea && placeholder) textarea.placeholder = placeholder;

  m.redraw();
}

/**
 * Ações extras vindas de fora do editor (a enquete do fof/polls mora no
 * cabeçalho do composer). Quem registra devolve `null` quando não se aplica.
 */
const externalActions: Array<() => (MoreAction & { key: string }) | null> = [];

export function addMoreAction(provider: () => (MoreAction & { key: string }) | null): void {
  externalActions.push(provider);
}

/** O alternador Markdown / "A". */
class RichToggle extends Component {
  view(): Mithril.Children {
    const rich = richMode();
    const label = rich ? t('composer.shell.switch_to_markdown') : t('composer.shell.switch_to_rich');

    return (
      <button
        type="button"
        className={`CanelaRichToggle ${rich ? '--rte' : '--markdown'}`}
        role="switch"
        aria-checked={rich ? 'true' : 'false'}
        aria-label={label}
        title={label}
        onclick={() => morphComposer(() => setRichMode(!rich))}
      >
        <span className="CanelaRichToggle-slider">
          <span className="CanelaRichToggle-left" aria-hidden="true">
            <Icon name="fab fa-markdown" />
          </span>
          <span className="CanelaRichToggle-right" aria-hidden="true">
            A
          </span>
        </span>
      </button>
    );
  }
}

/** O menu ⊕: abre para cima, preso à tela, fora da barra (que rola e cortaria). */
class MoreMenu extends Component<{ actions: () => MoreAction[] }> {
  private portal: HTMLElement | null = null;
  private outside: ((e: MouseEvent) => void) | null = null;

  view(): Mithril.Children {
    const label = t('composer.shell.more_options');

    return (
      <Button
        className="Button Button--icon Button--link CanelaMoreOptions"
        icon="fas fa-circle-plus"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        onclick={(e: MouseEvent) => this.toggle(e)}
      />
    );
  }

  toggle(e: MouseEvent): void {
    if (this.portal) return this.close();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const portal = document.createElement('div');

    portal.className = 'CanelaMoreOptions-portal';
    portal.style.left = `${Math.max(8, rect.left)}px`;
    portal.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    document.body.appendChild(portal);
    this.portal = portal;

    const render = () =>
      m.render(
        portal,
        <ul className="Dropdown-menu CanelaMoreOptions-menu" role="menu">
          {this.attrs.actions().map((action) => (
            <li>
              <button
                type="button"
                className={`CanelaMoreOptions-item${action.active ? ' active' : ''}`}
                role="menuitem"
                onclick={(event: MouseEvent) => {
                  this.close();
                  action.onclick(event);
                  m.redraw();
                }}
              >
                <Icon name={action.icon} />
                <span>{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      );

    render();

    this.outside = (event: MouseEvent) => {
      if (!portal.contains(event.target as Node) && !this.element.contains(event.target as Node)) this.close();
    };
    setTimeout(() => this.outside && document.addEventListener('mousedown', this.outside));
  }

  close(): void {
    if (this.outside) document.removeEventListener('mousedown', this.outside);
    this.outside = null;

    if (this.portal) {
      m.render(this.portal, null);
      this.portal.remove();
      this.portal = null;
    }
  }

  onremove(vnode: Mithril.VnodeDOM): void {
    super.onremove(vnode as any);
    this.close();
  }
}

/**
 * "‹" e "›": só aparecem quando a barra não cabe e há o que rolar para aquele
 * lado; rolam a barra 160px.
 */
class ScrollButton extends Component<{ dir: 'left' | 'right' }> {
  view(): Mithril.Children {
    const left = this.attrs.dir === 'left';

    return (
      <button
        type="button"
        className={`CanelaToolbarScroll CanelaToolbarScroll--${this.attrs.dir}`}
        aria-hidden="true"
        tabindex={-1}
        onclick={() => this.bar()?.scrollBy({ left: left ? -160 : 160, behavior: 'smooth' })}
      >
        <Icon name={left ? 'fas fa-chevron-left' : 'fas fa-chevron-right'} />
      </button>
    );
  }

  bar(): HTMLElement | null {
    return this.element?.closest('.TextEditor-toolbar') as HTMLElement | null;
  }

  oncreate(vnode: Mithril.VnodeDOM): void {
    super.oncreate(vnode as any);

    const bar = this.bar();
    const update = () => {
      if (!bar) return;
      const overflow = bar.scrollWidth - bar.clientWidth > 2;
      const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 2;
      bar.classList.toggle('has-overflow', overflow && !atEnd);
      bar.classList.toggle('has-overflow-left', overflow && bar.scrollLeft > 2);
    };

    bar?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    (this as any).canelaUpdate = update;
    update();
  }

  onupdate(vnode: Mithril.VnodeDOM): void {
    super.onupdate(vnode as any);
    (this as any).canelaUpdate?.();
  }

  onremove(vnode: Mithril.VnodeDOM): void {
    super.onremove(vnode as any);
    window.removeEventListener('resize', (this as any).canelaUpdate);
  }
}

function fromVnode(vnode: any, fallbackLabel = ''): MoreAction | null {
  const attrs = vnode?.attrs;
  if (!attrs || typeof attrs.onclick !== 'function') return null;

  const label = attrs.title || attrs.tooltipText || attrs['aria-label'] || extractText(vnode.children) || fallbackLabel;

  return { icon: attrs.icon || 'fas fa-circle', label: String(label).replace(/\s*<[^>]+>\s*$/, ''), onclick: attrs.onclick };
}

export default function installToolbar() {
  const ORDER: Record<string, number> = {
    bold: 1000,
    italic: 990,
    header: 980,
    link: 900,
    quote: 890,
    code: 880,
    unordered_list: 800,
    ordered_list: 790,
  };

  const MOVED_TO_MORE = ['strikethrough', 'spoiler', 'image'];
  const UPLOAD_KEYS = ['fof-upload', 'fof-upload-media'];

  let applied = false;

  extend(TextEditor.prototype, 'oninit', function () {
    if (applied) return;
    applied = true;

    // A letra do negrito vem da tradução ("N" em português, "B" em inglês).
    document.documentElement.style.setProperty('--cn-bold-label', JSON.stringify(t('composer.shell.bold_label')));

    // 1) Rodapé: o upload sai dos controles para entrar na barra.
    extend(TextEditor.prototype, 'controlItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!editorComposer(this)) return;

      this.canelaMore = [] as Array<MoreAction & { key: string }>;
      this.canelaUploads = UPLOAD_KEYS.filter((key) => items.has(key)).map((key) => ({ key, vnode: items.get(key) }));
      this.canelaUploadsPlaced = false;
      this.canelaUploads.forEach(({ key }: { key: string }) => items.remove(key));
    });

    // 2) Botões do markdown: ordem do Discourse, letras, extras para o ⊕.
    extend(TextEditor.prototype as any, 'markdownToolbarItems', function (this: any, items: ItemList<any>) {
      if (!editorComposer(this)) return;

      Object.entries(ORDER).forEach(([key, priority]) => {
        if (items.has(key)) items.setPriority(key, priority);
      });

      const set = (key: string, icon: string) => {
        const vnode = items.has(key) ? items.get(key) : null;
        if (vnode?.attrs) vnode.attrs.icon = icon;
      };

      set('bold', 'CanelaTextIcon CanelaTextIcon--bold');
      set('header', 'CanelaTextIcon CanelaTextIcon--heading');
      set('quote', 'fas fa-quote-right');

      MOVED_TO_MORE.forEach((key) => {
        if (!items.has(key)) return;
        const action = fromVnode(items.get(key));
        if (action) (this.canelaMore ||= []).push({ key, ...action });
        items.remove(key);
      });

      (this.canelaUploads || []).forEach(({ key, vnode }: { key: string; vnode: Mithril.Children }) => items.add(key, vnode, 870));
      this.canelaUploadsPlaced = true;

      items.add(
        'canelaDirection',
        <Button
          className="Button Button--icon Button--link CanelaDirection"
          icon="fas fa-right-left"
          title={t('composer.shell.toggle_direction')}
          aria-label={t('composer.shell.toggle_direction')}
          onclick={() => {
            const textarea = this.element?.querySelector('textarea') as HTMLTextAreaElement | null;
            if (textarea) textarea.dir = textarea.dir === 'rtl' ? 'ltr' : 'rtl';
          }}
        />,
        780
      );
    });

    // 3) A barra inteira: alternador, menção para o ⊕, o ⊕ e o "›".
    extend(TextEditor.prototype, 'toolbarItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!editorComposer(this)) return;

      // Sem o flarum/markdown, o upload fica na barra mesmo assim.
      if (!this.canelaUploadsPlaced)
        (this.canelaUploads || []).forEach(({ key, vnode }: { key: string; vnode: Mithril.Children }) => items.add(key, vnode, 90));

      items.add('canelaRich', <RichToggle />, 10000);

      if (items.has('mention')) {
        const action = fromVnode(items.get('mention'));
        if (action) (this.canelaMore ||= []).push({ key: 'mention', ...action });
        items.remove('mention');
      }

      const editor = this;
      const actions = (): MoreAction[] => [
        ...externalActions.map((provider) => provider()).filter((action): action is MoreAction & { key: string } => !!action),
        ...(editor.canelaMore || []),
      ];

      if (actions().length) items.add('canelaMore', <MoreMenu actions={actions} />, -1000);
      items.add('canelaScrollBack', <ScrollButton dir="left" />, 2000);
      items.add('canelaScroll', <ScrollButton dir="right" />, -2000);
    });
  });
}
