/*
 * A captura: desenha a tela no próprio navegador (html-to-image), cobre os
 * campos de senha e recorta a área marcada.
 *
 * O custo está em clonar a página copiando o estilo de cada elemento. Por
 * isso só entra o que aparece na área pedida (e os ancestrais, para o que
 * transborda do pai, como um menu aberto, não sumir): a área marcada sai em
 * ~150 ms em vez de segundos. As fontes são embutidas uma vez e reaproveitadas.
 *
 * Adaptado do Bugframe (github.com/vmatheus3/bug-frame, src/widget/capture.ts),
 * MIT, © 2026 vmatheus3 e colaboradores. Usa o html-to-image (MIT, © W.Y.).
 */
import { UI_ATTR, type Rect } from './context';

const SKIP_TAGS = new Set(['NOSCRIPT', 'SCRIPT', 'TEMPLATE']);

/** Fora de qualquer captura: a interface do recurso, os modais e os avisos do Flarum. */
const SKIP_SELECTOR = `[${UI_ATTR}], #modal, .ModalManager, #alerts, .AlertManager`;

const IS_SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

type Library = typeof import('html-to-image');

let library: Promise<Library> | null = null;
let fontCss: Promise<string> | null = null;

/** Baixa a biblioteca e embute as fontes antes do clique (o menu do botão chama isto). */
export function warm(): Promise<string> {
  library ||= import('html-to-image');
  fontCss ||= library.then((lib) => lib.getFontEmbedCSS(document.body)).catch(() => '');

  return fontCss;
}

/** O html-to-image clona o DOM e perde a rolagem das áreas internas: elas são deslocadas à mão durante a captura. */
function freezeScrolled(): () => void {
  const undo: (() => void)[] = [];

  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight && el !== document.documentElement && el !== document.body) {
      const shift = el.scrollTop;

      Array.from(el.children).forEach((child) => {
        const c = child as HTMLElement;
        const before = c.style.translate;

        c.style.translate = `0 ${-shift}px`;
        undo.push(() => (c.style.translate = before));
      });
    }
  });

  return () => undo.forEach((fn) => fn());
}

/**
 * Fora do clone, sem mexer no layout: o que não é desenhado (display: none e
 * afins) e o que está todo abaixo de `bottom` (a parte visível, ou a área
 * marcada). O que está acima fica, porque tirá-lo empurraria o resto para cima.
 */
function skippable(root: Element = document.body, bottom = window.innerHeight): Set<Element> {
  const skip = new Set<Element>();

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (skip.has(el.parentElement as Element)) continue;

    if (SKIP_TAGS.has(el.tagName) || el.matches(SKIP_SELECTOR)) {
      skip.add(el);
      continue;
    }

    if (!el.getClientRects().length) {
      if (getComputedStyle(el).display !== 'contents') skip.add(el);
      continue;
    }

    if (el.getBoundingClientRect().top >= bottom) skip.add(el);
  }

  return skip;
}

/** A cor de fundo que aparece atrás do elemento (a dele ou a do primeiro ancestral que tem uma). */
function backgroundOf(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;

    if (color && color !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }

  return '#ffffff';
}

/**
 * O menor elemento que contém a área inteira: desenhá-lo sozinho mantém o
 * layout dele e custa pouco. Null quando só a página toda contém a área.
 */
function containerOf(box: Rect): HTMLElement | null {
  const probe = document.elementsFromPoint(box.x + box.w / 2, box.y + box.h / 2).find((el) => !el.closest(SKIP_SELECTOR));

  for (
    let node = probe as HTMLElement | null | undefined;
    node && node !== document.body && node !== document.documentElement;
    node = node.parentElement
  ) {
    const r = node.getBoundingClientRect();

    // Com conteúdo rolado ou transbordando, o elemento sozinho não mostraria o que está na tela: sobe para o pai.
    const overflows = node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;

    if (!overflows && r.left <= box.x + 1 && r.top <= box.y + 1 && r.right >= box.x + box.w - 1 && r.bottom >= box.y + box.h - 1) return node;
  }

  return null;
}

async function loadLibrary(): Promise<[Library, string]> {
  return Promise.all([library || (library = import('html-to-image')), warm()]);
}

/** A tela inteira, num canvas do tamanho da janela. */
async function renderPage(scale?: number): Promise<HTMLCanvasElement> {
  const [lib, fonts] = await loadLibrary();
  const skip = skippable();
  const options = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: scale ?? Math.min(window.devicePixelRatio || 1, 2),
    cacheBust: false,
    fontEmbedCSS: fonts || undefined,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    style: {
      transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
      transformOrigin: 'top left',
      width: `${document.documentElement.scrollWidth}px`,
      height: `${document.documentElement.scrollHeight}px`,
    },
    filter: (node: Node) => !(node instanceof Element) || !skip.has(node),
  };
  const restore = freezeScrolled();

  try {
    // O Safari desenha as imagens tarde na primeira vez: lá, uma passada aquece o cache e a segunda vale.
    if (IS_SAFARI) await lib.toCanvas(document.body, options).catch(() => null);

    return await lib.toCanvas(document.body, options);
  } finally {
    restore();
  }
}

/** Só o elemento, num canvas do tamanho dele (sem o que fica abaixo de `bottom`). */
async function renderElement(el: HTMLElement, bottom: number): Promise<HTMLCanvasElement> {
  const [lib, fonts] = await loadLibrary();
  const skip = skippable(el, bottom);
  const options = {
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    cacheBust: false,
    fontEmbedCSS: fonts || undefined,
    backgroundColor: backgroundOf(el),
    // O elemento sai da posição dele na página (fixa ou não) e é desenhado no canto do quadro.
    style: { margin: '0', transform: 'none', position: 'relative', inset: 'auto' },
    filter: (node: Node) => !(node instanceof Element) || !skip.has(node),
  };
  const restore = freezeScrolled();

  try {
    if (IS_SAFARI) await lib.toCanvas(el, options).catch(() => null);

    return await lib.toCanvas(el, options);
  } finally {
    restore();
  }
}

/** Cobre, no canvas que mostra `origin`, os campos de senha e o que o tema marcar com [data-bug-mask]. */
function mask(canvas: HTMLCanvasElement, origin: Rect): void {
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const sx = canvas.width / origin.w;
  const sy = canvas.height / origin.h;

  ctx.fillStyle = '#3a3f4b';

  document.querySelectorAll('input[type="password"], [data-bug-mask]').forEach((el) => {
    if (el.closest(`[${UI_ATTR}]`)) return;

    const r = el.getBoundingClientRect();

    if (r.width >= 1 && r.height >= 1) {
      ctx.fillRect(Math.floor((r.left - origin.x) * sx), Math.floor((r.top - origin.y) * sy), Math.ceil(r.width * sx), Math.ceil(r.height * sy));
    }
  });
}

/** Recorta `rect` (em pixels da tela) de um canvas que mostra `origin`. */
function crop(canvas: HTMLCanvasElement, origin: Rect, rect: Rect): HTMLCanvasElement {
  const sx = canvas.width / origin.w;
  const sy = canvas.height / origin.h;
  const x = Math.max(0, Math.round((rect.x - origin.x) * sx));
  const y = Math.max(0, Math.round((rect.y - origin.y) * sy));
  const w = Math.max(1, Math.min(canvas.width - x, Math.round(rect.w * sx)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.round(rect.h * sy)));
  const out = document.createElement('canvas');

  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  return out;
}

const viewportRect = (): Rect => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });

/** A área marcada, em PNG (nítido para texto). */
export async function captureArea(rect: Rect): Promise<string> {
  const container = containerOf(rect);

  if (container) {
    const box = container.getBoundingClientRect();
    const origin = { x: box.left, y: box.top, w: box.width, h: box.height };
    const canvas = await renderElement(container, rect.y + rect.h);

    mask(canvas, origin);

    return crop(canvas, origin, rect).toDataURL('image/png');
  }

  const canvas = await renderPage();

  mask(canvas, viewportRect());

  return crop(canvas, viewportRect(), rect).toDataURL('image/png');
}

/** A tela inteira, em JPEG (bem menor que o PNG, e boa o bastante como referência). */
export async function captureScreen(scale?: number): Promise<string> {
  const canvas = await renderPage(scale);

  mask(canvas, viewportRect());

  return canvas.toDataURL('image/jpeg', 0.85);
}
