/*
 * O sumário do tópico: os títulos do
 * primeiro post numa lista na coluna da linha do tempo, com o título em que o
 * leitor está marcado por uma barra, os subníveis abrindo conforme a rolagem
 * e "Ir para o fim" (o fim do post). Um botão embaixo troca entre o sumário e
 * a linha do tempo ("Linha de tempo" / "Conteúdo"), lembrado no navegador; no
 * tópico de um post só, fica o sumário, sem o botão.
 *
 * O sumário aparece quando o primeiro post pede ([toc]) ou a discussão está
 * numa das tags do admin, e tem pelo menos N títulos (o mínimo do admin). Os
 * ids dos títulos são os mesmos das âncoras (gaps/cooked/decorate.ts).
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { slugify } from '../../gaps/cooked/decorate';
import { forumBool, forumInt, t } from '../../utils/settings';

export interface TocHeading {
  id: string;
  level: number;
  text: string;
  children: TocHeading[];
}

const VISIBLE_KEY = 'canela.tocVisible';
/** A distância do topo em que um título conta como "o de agora". */
const POSITION_BUFFER = 150;

let memoryVisible = true;

export function tocOn(): boolean {
  return forumBool('canelaCookedBackend', false) && forumBool('canelaToc', true);
}

export function tocVisible(): boolean {
  try {
    return localStorage.getItem(VISIBLE_KEY) !== 'false';
  } catch {
    return memoryVisible;
  }
}

export function toggleToc(): void {
  memoryVisible = !tocVisible();

  try {
    localStorage.setItem(VISIBLE_KEY, String(memoryVisible));
  } catch {
    // Vale até sair da página.
  }

  m.redraw();
}

/** O primeiro post: a relação da discussão ou o primeiro id do tópico. */
export function firstPostOf(discussion: Discussion): Post | null {
  const related = discussion.firstPost?.() as Post | false | undefined;

  if (related) return related;

  const first = app.store.getById<Post>('posts', discussion.postIds?.()[0]);

  return first && first.number() === 1 ? first : null;
}

function autoTag(discussion: Discussion): boolean {
  const ids = String(app.forum.attribute('canelaTocAutoTags') || '')
    .split(/[\s,|]+/)
    .filter(Boolean);

  if (!ids.length) return false;

  const tags = ((discussion as any).tags?.() || []) as Array<{ id(): string | undefined }>;

  return tags.some((tag) => tag && ids.includes(String(tag.id())));
}

const cache = new WeakMap<Post, { html: string; tree: TocHeading[]; count: number; marker: boolean }>();

/** Os títulos do post, em árvore, com os mesmos ids das âncoras. */
export function postHeadings(post: Post): { tree: TocHeading[]; count: number; marker: boolean } {
  const html = post.contentHtml() || '';
  const cached = cache.get(post);

  if (cached && cached.html === html) return cached;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const used = new Set<string>();
  const flat: TocHeading[] = [];

  root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    if (heading.closest('blockquote, .CanelaEmbeddedPost')) return;

    const base = slugify(heading.textContent || '') || 'h';
    let slug = base;

    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);

    const level = Number(heading.tagName.slice(1));

    // O h6 entra na conta dos ids (as âncoras o contam), mas não no sumário.
    if (level <= 5) flat.push({ id: `p-${post.id()}-${slug}`, level, text: (heading.textContent || '').trim(), children: [] });
  });

  const tree: TocHeading[] = [];
  const stack: TocHeading[] = [];

  for (const heading of flat) {
    while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop();

    (stack.length ? stack[stack.length - 1].children : tree).push(heading);
    stack.push(heading);
  }

  const result = { html, tree, count: flat.length, marker: !!root.querySelector('[data-theme-toc]') };
  cache.set(post, result);

  return result;
}

/** O sumário vale nesta discussão (e o primeiro post já está carregado). */
export function tocFor(discussion: Discussion | null | undefined): { post: Post; tree: TocHeading[] } | null {
  if (!tocOn() || !discussion) return null;

  const post = firstPostOf(discussion);

  if (!post) return null;

  const headings = postHeadings(post);

  if (!headings.marker && !autoTag(discussion)) return null;
  if (headings.count < forumInt('canelaTocMinHeadings', 3)) return null;

  return { post, tree: headings.tree };
}

function headerOffset(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cn-header-height')) || 52;

  return value;
}

/** Vai até o título (carregando o primeiro post antes, se ele não estiver na página). */
export function goToHeading(id: string, stream: any): void {
  const scroll = () => {
    const element = document.getElementById(id);

    if (!element) return false;

    const top = element.getBoundingClientRect().top + window.scrollY - headerOffset() - 16;
    window.scrollTo({ top, behavior: 'smooth' });
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${id}`);

    return true;
  };

  if (scroll() || !stream) return;

  Promise.resolve(stream.goToNumber(1)).then(() => window.setTimeout(scroll, 150));
}

export interface TocAttrs extends ComponentAttrs {
  post: Post;
  tree: TocHeading[];
  stream: any;
}

export default class TableOfContents extends Component<TocAttrs> {
  private active: string | null = null;
  private ancestors = new Set<string>();
  private onScroll = () => this.track();
  private frame = 0;

  oncreate(vnode: Mithril.VnodeDOM<TocAttrs, this>) {
    super.oncreate(vnode);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.track();
  }

  onremove(vnode: Mithril.VnodeDOM<TocAttrs, this>) {
    super.onremove(vnode);
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.frame);
  }

  /** O título de agora: o último cujo topo já passou da linha do cabeçalho + folga. */
  private track(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const flat: Array<{ heading: TocHeading; parents: string[] }> = [];
      const walk = (items: TocHeading[], parents: string[]) =>
        items.forEach((heading) => {
          flat.push({ heading, parents });
          walk(heading.children, [...parents, heading.id]);
        });

      walk(this.attrs.tree, []);

      const line = headerOffset() + POSITION_BUFFER;
      let current = flat[0] || null;

      for (const entry of flat) {
        const element = document.getElementById(entry.heading.id);

        if (element && element.getBoundingClientRect().top <= line) current = entry;
      }

      const id = current?.heading.id || null;

      if (id !== this.active) {
        this.active = id;
        this.ancestors = new Set(current?.parents || []);
        m.redraw();
      }
    });
  }

  private list(items: TocHeading[], depth: number): Mithril.Children {
    return (
      <ul className={depth === 0 ? 'CanelaToc-list' : 'CanelaToc-sublevel'}>
        {items.map((heading) => {
          const open = heading.id === this.active || this.ancestors.has(heading.id);

          return (
            <li
              key={heading.id}
              className={classList('CanelaToc-item', `CanelaToc-h${heading.level}`, {
                'CanelaToc-item--active': open,
                'CanelaToc-item--current': heading.id === this.active,
              })}
            >
              <a
                href={`#${heading.id}`}
                onclick={(event: MouseEvent) => {
                  event.preventDefault();
                  goToHeading(heading.id, this.attrs.stream);
                }}
              >
                {heading.text}
              </a>
              {heading.children.length > 0 && this.list(heading.children, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  view(): Mithril.Children {
    return (
      <div className="CanelaToc">
        <div className="CanelaToc-scroll">{this.list(this.attrs.tree, 0)}</div>
        <Button className="Button Button--link CanelaToc-end" icon="fas fa-arrow-down" onclick={() => this.jumpToEnd()}>
          {t('toc.jump_end')}
        </Button>
      </div>
    );
  }

  /** "Ir para o fim": o fim do primeiro post (logo acima dos botões dele). */
  private jumpToEnd(): void {
    const item = document.querySelector<HTMLElement>(`.PostStream-item[data-id="${this.attrs.post.id()}"] .Post-body`);

    if (!item) {
      this.attrs.stream?.goToNumber?.(1);
      return;
    }

    const bottom = item.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 120;
    window.scrollTo({ top: Math.max(0, bottom), behavior: 'smooth' });
  }
}

/** "Linha de tempo" / "Conteúdo": a troca entre os dois. */
export function tocToggle(): Mithril.Children {
  const showing = tocVisible();

  return (
    <Button className="Button CanelaToc-toggle" icon={showing ? 'fas fa-timeline' : 'fas fa-bars-staggered'} onclick={toggleToc}>
      {showing ? t('toc.show_timeline') : t('toc.show_toc')}
    </Button>
  );
}
