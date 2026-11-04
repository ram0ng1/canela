import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import Icon from 'flarum/common/components/Icon';

import AboutNav from './AboutNav';
import CommunityPage from './CommunityPage';
import { t } from '../../utils/settings';
import { aiApiUrl } from '../ai/state';
import { autoTranslate, understoodLocales } from '../ai/translation';

type RulesSection = { id: string; title: string; html: string };

export interface RulesPayload {
  html: string | null;
  title?: string;
}

/** A página traduzida pela IA (POST /canela/ai/translate-page). */
interface PageTranslation {
  html: string;
  title: string;
  locale: string;
}

/** Quantas rodadas o fórum pede uma página que volta "pendente" (uma página longa vai em partes). */
const MAX_ROUNDS = 8;

/** "pt-BR" e "pt" contam como o mesmo idioma. */
const baseLanguage = (code: string) => code.split(/[-_]/)[0].toLowerCase();

/**
 * Corta o HTML nos títulos `h2`: o que vem antes é a abertura (vai para o
 * topo) e cada título vira uma seção com âncora. Nos itens de lista, cada um
 * vira uma "regra" numerada. O HTML é o do servidor (página do fof/pages ou
 * texto do admin), já higienizado lá.
 */
function structure(html: string): { intro: string; sections: RulesSection[] } {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement;
  const sections: RulesSection[] = [];
  const intro: string[] = [];
  let current: { title: string; nodes: string[] } | null = null;
  const used = new Set<string>();

  const flush = () => {
    if (!current) return;

    let id =
      'regra-' +
      (current.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || sections.length + 1);
    while (used.has(id)) id += '-';
    used.add(id);
    sections.push({ id, title: current.title, html: current.nodes.join('') });
  };

  Array.from(root?.childNodes || []).forEach((node) => {
    if (node instanceof HTMLElement && node.tagName === 'H2') {
      flush();
      current = { title: node.textContent?.trim() || '', nodes: [] };
      return;
    }

    if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
      node.classList.add('CanelaRules-list');
      Array.from(node.children).forEach((li, index) => {
        li.classList.add('CanelaRules-rule');
        li.setAttribute('data-n', String(index + 1));
      });
    }

    // O texto solto vira parágrafo pelo DOM: montado como string, o
    // `textContent` (já sem as entidades) voltaria a ser HTML.
    let out = '';

    if (node instanceof HTMLElement) {
      out = node.outerHTML;
    } else if (node.textContent?.trim()) {
      const paragraph = document.createElement('p');
      paragraph.textContent = node.textContent;
      out = paragraph.outerHTML;
    }

    (current ? current.nodes : intro).push(out);
  });

  flush();

  return { intro: intro.join(''), sections };
}

/**
 * Base das páginas de regras da área Sobre (as Diretrizes e as páginas extras
 * do fof/pages): título, índice de seções em pílulas e cada seção num cartão.
 * Cada página só diz de onde vem o HTML e qual aba fica ativa.
 */
export default abstract class RulesPage extends CommunityPage {
  html: string | null = null;
  pageTitle: string | null = null;
  failed = false;
  /** A tradução para o idioma de quem lê, quando a IA a fez. */
  translation: PageTranslation | null = null;
  translating = false;
  /** O 文A virou para o original. */
  showOriginal = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (this.enabled()) this.load();
  }

  /** O endereço na API, relativo (`/canela-guidelines`). */
  abstract endpoint(): string;

  /** A aba de AboutNav que fica marcada. */
  abstract activeTab(): string;

  load(): void {
    app
      .request<unknown>({
        method: 'GET',
        url: `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}${this.endpoint()}`,
      })
      .then((response) => {
        const data = this.parse(response);
        this.html = data?.html || '';
        this.pageTitle = data?.title || null;
        this.loaded(data);
        if (this.html) this.translate(0);
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
  }

  /**
   * A página para a tradução automática (`guidelines` ou `page:{id}`), ou
   * null quando ela não se traduz.
   */
  translationSource(): string | null {
    return null;
  }

  /**
   * Pede a tradução depois de desenhar o original (a leitura nunca espera o
   * modelo), com a tradução automática ligada e um idioma alvo no fórum. A
   * página já no idioma de quem lê volta "skip"; a longa, "pending", e vai de
   * novo até terminar.
   */
  translate(round: number): void {
    const source = this.translationSource();
    const target = app.forum.attribute<{ locale: string | null } | null>('canelaAiTranslation');

    if (!source || !target?.locale || !autoTranslate()) return;

    this.translating = true;

    app
      .request<{ html?: string; title?: string; locale?: string; pending?: boolean; retryAfter?: number }>({
        method: 'POST',
        url: aiApiUrl('translate-page'),
        body: { source },
        // Sem tradução, fica o original: não é um erro que a pessoa precise ver.
        errorHandler: () => {},
      })
      .then((response) => {
        if (response?.html) {
          this.translation = { html: response.html, title: response.title || '', locale: response.locale || '' };
          // Um idioma que a pessoa marcou como lido no original abre no original.
          const base = baseLanguage(this.translation.locale);
          this.showOriginal = understoodLocales().some((code) => baseLanguage(code) === base);
          this.translating = false;
        } else if (response?.pending && round < MAX_ROUNDS) {
          window.setTimeout(() => this.translate(round + 1), response.retryAfter ? response.retryAfter * 1000 : 1500);

          return;
        } else {
          this.translating = false;
        }
      })
      .catch(() => (this.translating = false))
      .finally(() => m.redraw());
  }

  /** O 文A ao lado do título: alterna a tradução e o original; girando enquanto traduz. */
  translationToggle(): Mithril.Children {
    if (this.translating) {
      const label = t('ai.translation.translating');

      return (
        <span className="CanelaRules-translate is-working" role="status" aria-label={label} title={label}>
          <Icon name="fas fa-spinner fa-spin" />
        </span>
      );
    }

    if (!this.translation) return null;

    const label = t(this.showOriginal ? 'ai.translation.click_to_show_translation' : 'ai.translation.click_to_show_original');

    return (
      <button
        type="button"
        className={`CanelaRules-translate${this.showOriginal ? ' is-original' : ''}`}
        aria-pressed={this.showOriginal ? 'false' : 'true'}
        aria-label={label}
        title={`${label} ${t('ai.translation.disclaimer')}`}
        onclick={() => (this.showOriginal = !this.showOriginal)}
      >
        <Icon name="fas fa-language" />
      </button>
    );
  }

  /** O HTML e o título na resposta da API (as Diretrizes já vêm assim). */
  parse(response: unknown): RulesPayload {
    return response as RulesPayload;
  }

  /** Depois de carregar (a página extra troca o título da aba do navegador). */
  loaded(_data: RulesPayload): void {}

  content(): Mithril.Children {
    let body: Mithril.Children;

    if (this.failed) body = <p className="CanelaCommunity-empty">{t('community.load_error')}</p>;
    else if (this.html === null) body = this.skeleton();
    else body = this.rules(this.translation && !this.showOriginal ? this.translation.html : this.html);

    return (
      <div className="CanelaAbout CanelaGuidelines">
        <header className="CanelaAbout-header">{AboutNav(this.activeTab())}</header>
        {body}
      </div>
    );
  }

  /**
   * O texto ainda vindo: o título (já conhecido) e dois cartões de regras com
   * as classes dos reais, com barras de texto no lugar das linhas, para o
   * conteúdo chegar onde o esqueleto estava.
   */
  skeleton(): Mithril.Children {
    const line = (width: string) => <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width }} />;

    return (
      <div className="CanelaRules CanelaRules--loading" aria-busy="true">
        <h1 className="CanelaRules-title">{this.title()}</h1>
        <nav className="CanelaRules-toc" aria-hidden="true">
          {['9em', '12em', '8em', '11em', '10em', '7em'].map((width) => (
            <a>
              <span className="CanelaSkeleton CanelaSkeleton--word" style={{ width }} />
            </a>
          ))}
        </nav>
        {[
          ['30%', ['100%', '94%', '72%']],
          ['24%', ['96%', '100%', '58%']],
        ].map(([title, lines]) => (
          <section className="CanelaRules-card">
            <h2 className="CanelaRules-sectionTitle">{line(title as string)}</h2>
            <div className="CanelaRules-body Post-body">
              <p>{(lines as string[]).map(line)}</p>
            </div>
          </section>
        ))}
      </div>
    );
  }

  rules(html: string): Mithril.Children {
    const { intro, sections } = structure(html);
    const translated = this.translation && !this.showOriginal ? this.translation.title : '';
    const title = translated || this.pageTitle || this.title();

    return (
      <div className="CanelaRules">
        <div className="CanelaRules-heading">
          <h1 className="CanelaRules-title">{title}</h1>
          {this.translationToggle()}
        </div>

        {/* Sem nenhum h2, o texto todo é o conteúdo: vai num cartão, com as regras numeradas. */}
        {intro &&
          (sections.length ? (
            <div className="CanelaRules-intro Post-body">{m.trust(intro)}</div>
          ) : (
            <section className="CanelaRules-card">
              <div className="CanelaRules-body Post-body">{m.trust(intro)}</div>
            </section>
          ))}

        {sections.length > 1 && (
          <nav className="CanelaRules-toc" aria-label={title}>
            {sections.map((section) => (
              <a
                href={`#${section.id}`}
                onclick={(e: MouseEvent) => {
                  e.preventDefault();
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {section.title}
              </a>
            ))}
          </nav>
        )}

        {sections.map((section) => (
          <section className="CanelaRules-card" id={section.id}>
            <h2 className="CanelaRules-sectionTitle">{section.title}</h2>
            <div className="CanelaRules-body Post-body">{m.trust(section.html)}</div>
          </section>
        ))}
      </div>
    );
  }
}
