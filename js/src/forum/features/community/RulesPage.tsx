import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import AboutNav from './AboutNav';
import CommunityPage from './CommunityPage';
import { t } from '../../utils/settings';

type RulesSection = { id: string; title: string; html: string };

export interface RulesPayload {
  html: string | null;
  title?: string;
}

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
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
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
    else body = this.rules(this.html);

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
    const title = this.pageTitle || this.title();

    return (
      <div className="CanelaRules">
        <h1 className="CanelaRules-title">{title}</h1>

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
