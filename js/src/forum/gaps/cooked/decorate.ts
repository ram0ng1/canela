/*
 * Os enfeites que o Discourse põe no conteúdo dos posts (o "cooked"), depois
 * que o HTML entra na página:
 *
 * - blocos de código com os botões "copiar" e "tela cheia" (codeblock-buttons);
 * - títulos (h1–h6) com o link "#" que aparece ao passar o mouse (a.anchor);
 * - tabelas largas com o botão "Expandir tabela";
 * - spoilers borrados, revelados no clique (spoiler-alert).
 *
 * Tudo acontece DENTRO de elementos que já existem (pre, h2, table…): o post
 * entra com m.trust, e o Mithril remove esse HTML contando os nós de cima —
 * embrulhar um bloco num <div> novo trocaria essa contagem e deixaria lixo
 * na página quando o post fosse editado.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { copyText } from '../utils/clipboard';

const DONE = 'canelaDecorated';
/** Quanto tempo o "copiado!" fica no botão. */
const COPIED_MS = 2000;

function iconButton(className: string, icon: string, label: string, onclick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `Button Button--icon CanelaCodeButton ${className}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i aria-hidden="true" class="icon ${icon} Button-icon"></i>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onclick(button);
  });

  return button;
}

function decorateCode(body: HTMLElement): void {
  if (!gaps.codeButtons()) return;

  body.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
    if (pre.dataset[DONE]) return;

    const code = pre.querySelector('code') || pre;

    pre.dataset[DONE] = '1';
    pre.classList.add('CanelaCodeBlock');

    const wrapper = document.createElement('div');
    wrapper.className = 'CanelaCodeBlock-buttons';
    wrapper.setAttribute('contenteditable', 'false');

    wrapper.appendChild(
      iconButton('CanelaCodeButton--copy', 'far fa-copy', t('gaps.code.copy'), (button) => {
        copyText(code.textContent || '').then((ok) => {
          if (!ok) return;

          button.classList.add('CanelaCodeButton--done');
          button.innerHTML = `<i aria-hidden="true" class="icon fas fa-check Button-icon"></i>`;
          button.title = t('gaps.code.copied');

          window.setTimeout(() => {
            button.classList.remove('CanelaCodeButton--done');
            button.innerHTML = `<i aria-hidden="true" class="icon far fa-copy Button-icon"></i>`;
            button.title = t('gaps.code.copy');
          }, COPIED_MS);
        });
      })
    );

    wrapper.appendChild(
      iconButton('CanelaCodeButton--fullscreen', 'fas fa-up-right-and-down-left-from-center', t('gaps.code.fullscreen'), () => {
        const copy = pre.cloneNode(true) as HTMLElement;
        copy.querySelector('.CanelaCodeBlock-buttons')?.remove();

        app.modal.show(() => import('./FullscreenModal'), { title: t('gaps.code.view_code'), html: copy.outerHTML, kind: 'code' });
      })
    );

    pre.insertBefore(wrapper, pre.firstChild);
  });
}

/** O "nome" do título, como o markdown-it do Discourse: minúsculas, hífens, sem acento. */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function decorateHeadings(body: HTMLElement, postId: string): void {
  if (!gaps.headingAnchors()) return;

  const used = new Set<string>();

  body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    if (heading.dataset[DONE] || heading.closest('blockquote, .CanelaEmbeddedPost')) return;

    const base = slugify(heading.textContent || '') || 'h';
    let slug = base;

    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);

    // O id leva o post: dois posts com o mesmo título não disputam a âncora.
    const id = `p-${postId}-${slug}`;

    heading.dataset[DONE] = '1';
    heading.id = id;

    const anchor = document.createElement('a');
    anchor.className = 'CanelaAnchor';
    anchor.href = `#${id}`;
    anchor.title = t('gaps.heading_anchor');
    anchor.setAttribute('aria-label', t('gaps.heading_anchor'));
    anchor.addEventListener('click', (event) => {
      event.preventDefault();

      // Sem trocar a rota do Mithril (o hash viraria uma navegação): o
      // endereço ganha a âncora e a página rola até o título.
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${id}`);
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    heading.insertBefore(anchor, heading.firstChild);

    // Quem chega por um link com a âncora cai no título, e não no topo do post.
    if (window.location.hash === `#${id}`) window.setTimeout(() => heading.scrollIntoView({ block: 'start' }), 300);
  });
}

function decorateTables(body: HTMLElement): void {
  if (!gaps.tableExpand()) return;

  body.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (table.dataset[DONE]) return;

    table.dataset[DONE] = '1';

    // Só as tabelas que não cabem ganham o botão, como no Discourse.
    if (table.scrollWidth <= table.clientWidth + 2) return;

    const caption = document.createElement('caption');
    caption.className = 'CanelaTableExpand';
    caption.setAttribute('contenteditable', 'false');

    const button = iconButton('CanelaTableExpand-button', 'fas fa-up-right-and-down-left-from-center', t('gaps.table.expand'), () => {
      const copy = table.cloneNode(true) as HTMLElement;
      copy.querySelector('.CanelaTableExpand')?.remove();

      app.modal.show(() => import('./FullscreenModal'), { title: t('gaps.table.view_table'), html: copy.outerHTML, kind: 'table' });
    });
    button.insertAdjacentText('beforeend', t('gaps.table.expand'));
    caption.appendChild(button);

    table.insertBefore(caption, table.firstChild);
  });
}

function reveal(spoiler: HTMLElement): void {
  spoiler.classList.remove('CanelaSpoiler--blurred');
  spoiler.removeAttribute('aria-label');
  spoiler.removeAttribute('role');
  spoiler.removeAttribute('tabindex');
}

function decorateSpoilers(body: HTMLElement): void {
  if (!gaps.spoilerBlur()) return;

  // O spoiler em linha do Litedown (||texto||) e o de bloco (>! texto), que
  // vem como <details> sem resumo: os dois viram o borrão do Discourse.
  body.querySelectorAll<HTMLElement>('span.spoiler, details.spoiler').forEach((spoiler) => {
    if (spoiler.dataset[DONE]) return;

    spoiler.dataset[DONE] = '1';
    spoiler.classList.add('CanelaSpoiler', 'CanelaSpoiler--blurred');
    spoiler.setAttribute('role', 'button');
    spoiler.setAttribute('tabindex', '0');
    spoiler.setAttribute('aria-label', t('gaps.spoiler.reveal'));

    if (spoiler.tagName === 'DETAILS') {
      // Sem um <summary> do autor, o navegador desenha o "Detalhes" padrão,
      // que o CSS não alcança; um vazio (escondido) toma o lugar dele.
      if (!spoiler.querySelector(':scope > summary')) {
        const summary = document.createElement('summary');
        summary.className = 'CanelaSpoiler-summary';
        spoiler.insertBefore(summary, spoiler.firstChild);
      }

      (spoiler as HTMLDetailsElement).open = true;
    }

    const onReveal = (event: Event) => {
      if (!spoiler.classList.contains('CanelaSpoiler--blurred')) return;

      // O primeiro clique só revela: um link escondido não pode navegar.
      event.preventDefault();
      event.stopPropagation();
      reveal(spoiler);
    };

    spoiler.addEventListener('click', onReveal, true);
    spoiler.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') onReveal(event);
    });
  });
}

/**
 * As datas locais do Discourse ([date=2026-10-20 time=14:00 timezone=…]):
 * o servidor manda a data no fuso de quem escreveu; aqui ela vira a mesma
 * hora no fuso de quem lê, com o ícone de globo e a hora original no título.
 */
function zonedToDate(date: string, time: string, zone: string): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = (time || '00:00').split(':').map(Number);
  const utc = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0);

  if (!zone) return time ? new Date(year, month - 1, day, hour || 0, minute || 0, second || 0) : new Date(utc);

  try {
    // A diferença entre o fuso pedido e o UTC naquele instante (horário de verão incluso).
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const asZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));

    return new Date(utc - (asZone - utc));
  } catch {
    return null;
  }
}

function decorateLocalDates(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>('span.canela-local-date').forEach((span) => {
    if (span.dataset[DONE]) return;

    span.dataset[DONE] = '1';

    const date = span.dataset.date || '';
    const time = span.dataset.time || '';
    const zone = span.dataset.timezone || '';
    const moment = /^\d{4}-\d{2}-\d{2}$/.test(date) ? zonedToDate(date, time, zone) : null;

    if (!moment || isNaN(moment.getTime())) return;

    const locale = app.translator.getLocale() || undefined;
    const options: Intl.DateTimeFormatOptions = time
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

    span.classList.add('CanelaLocalDate');
    span.title = [span.textContent || '', zone].filter(Boolean).join(': ');
    span.innerHTML = '<i aria-hidden="true" class="icon fas fa-globe"></i> ';
    span.appendChild(document.createTextNode(new Intl.DateTimeFormat(locale, options).format(moment)));
  });
}

export function decorateCooked(body: HTMLElement, postId: string): void {
  decorateLocalDates(body);
  decorateSpoilers(body);
  decorateCode(body);
  decorateHeadings(body, postId);
  decorateTables(body);
}

export default function installCookedDecorators(): void {
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body') as HTMLElement | null;
    const post = this.attrs?.post;

    if (!body || !post) return;

    decorateCooked(body, String(post.id()));
  });
}
