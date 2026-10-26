/*
 * A captura: desenha a parte visível da página num PNG, no próprio navegador
 * (html-to-image), cobre os campos de senha e recorta a área marcada.
 *
 * Adaptado do Bugframe (github.com/vmatheus3/bug-frame, src/widget/capture.ts),
 * MIT, © 2026 vmatheus3 e colaboradores. Usa o html-to-image (MIT, © W.Y.).
 */
import { UI_ATTR, type Rect } from './context';

const SKIP_TAGS = new Set(['NOSCRIPT', 'SCRIPT', 'TEMPLATE']);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** A parte visível da página, como PNG (data URL). */
export async function captureViewport(): Promise<string> {
  const { toPng } = await import('html-to-image');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const options = {
    width: w,
    height: h,
    pixelRatio,
    cacheBust: false,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    style: {
      transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
      transformOrigin: 'top left',
      width: `${document.documentElement.scrollWidth}px`,
      height: `${document.documentElement.scrollHeight}px`,
    },
    // Fora: a interface do recurso e o que o navegador não desenha (o <noscript>
    // do Flarum viraria texto solto na captura).
    filter: (node: Node) => !(node instanceof Element) || (!node.hasAttribute(UI_ATTR) && !SKIP_TAGS.has(node.tagName)),
  };
  const restore = freezeScrolled();

  try {
    // O Safari desenha as imagens tarde na primeira vez: uma passada aquece o cache, a segunda vale.
    try {
      await toPng(document.body, options);
    } catch {
      // A segunda passada mostra o erro de verdade.
    }

    await sleep(60);

    return await toPng(document.body, options);
  } finally {
    restore();
  }
}

/** Os retângulos a cobrir na captura: campos de senha e o que o tema marcar com [data-bug-mask]. */
export function maskRects(): Rect[] {
  const rects: Rect[] = [];

  document.querySelectorAll('input[type="password"], [data-bug-mask]').forEach((el) => {
    if (el.closest(`[${UI_ATTR}]`)) return;

    const r = el.getBoundingClientRect();

    if (r.width >= 1 && r.height >= 1) rects.push({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  });

  return rects;
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('screenshot'));
    img.src = src;
  });

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('canvas');

  return [canvas, ctx];
}

/** Pinta caixas opacas sobre os retângulos (em pixels da tela, em qualquer escala da captura). */
export async function maskImage(full: string, rects: Rect[], viewport: { w: number; h: number }): Promise<string> {
  if (!rects.length) return full;

  const img = await load(full);
  const sx = img.naturalWidth / viewport.w;
  const sy = img.naturalHeight / viewport.h;
  const [canvas, ctx] = canvasOf(img.naturalWidth, img.naturalHeight);

  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#3a3f4b';

  for (const r of rects) ctx.fillRect(Math.floor(r.x * sx), Math.floor(r.y * sy), Math.ceil(r.w * sx), Math.ceil(r.h * sy));

  return canvas.toDataURL('image/png');
}

/** Recorta a captura na área marcada (em pixels da tela). */
export async function cropImage(full: string, rect: Rect, viewport: { w: number; h: number }): Promise<string> {
  const img = await load(full);
  const sx = img.naturalWidth / viewport.w;
  const sy = img.naturalHeight / viewport.h;
  const x = Math.max(0, Math.round(rect.x * sx));
  const y = Math.max(0, Math.round(rect.y * sy));
  const w = Math.max(1, Math.min(img.naturalWidth - x, Math.round(rect.w * sx)));
  const h = Math.max(1, Math.min(img.naturalHeight - y, Math.round(rect.h * sy)));
  const [canvas, ctx] = canvasOf(w, h);

  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  return canvas.toDataURL('image/png');
}

/** A tela inteira em JPEG: bem menor que o PNG, e boa o bastante como referência. */
export async function toJpeg(full: string): Promise<string> {
  const img = await load(full);
  const [canvas, ctx] = canvasOf(img.naturalWidth, img.naturalHeight);

  ctx.drawImage(img, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.85);
}
