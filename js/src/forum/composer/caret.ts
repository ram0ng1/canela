/*
 * A posição do cursor no textarea do composer, sem travar a página.
 *
 * O core usa o textarea-caret, que a cada pedido cria um div-espelho no
 * <body>, copia o estilo do campo, mede e apaga o div: dois recálculos da
 * página inteira por pedido (~100 ms aqui), e o mentions pede a posição a
 * cada tecla do `@`/`#` (e de novo a cada resultado da busca). Aqui o espelho
 * é um só por campo, mora ao lado dele com `contain: strict` (o navegador só
 * refaz o layout do espelho) e o estilo só é copiado de novo quando o campo
 * muda de tamanho. A posição de um ponto do texto só depende do texto antes
 * dele: com o mesmo começo, a resposta é a guardada.
 */
import { override } from 'flarum/common/extend';

/** As mesmas propriedades que o textarea-caret copia. */
const PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const;

interface Mirror {
  div: HTMLDivElement;
  /** O estilo do campo precisa ser copiado de novo (o campo mudou de tamanho). */
  stale: boolean;
  borderTop: number;
  borderLeft: number;
  /** A última medida: o texto até a posição (mais a palavra que começa nela, que pode quebrar a linha) e o resultado. */
  memo: { key: string; top: number; left: number } | null;
}

const mirrors = new WeakMap<HTMLTextAreaElement, Mirror>();

let resizes: ResizeObserver | null = null;

function watchResize(textarea: HTMLTextAreaElement): void {
  if (typeof ResizeObserver === 'undefined') return;

  resizes ||= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const mirror = mirrors.get(entry.target as HTMLTextAreaElement);

      if (mirror) {
        mirror.stale = true;
        mirror.memo = null;
      }
    }
  });

  resizes.observe(textarea);
}

function copyStyle(textarea: HTMLTextAreaElement, mirror: Mirror): void {
  const computed = window.getComputedStyle(textarea);
  const style = mirror.div.style;

  for (const prop of PROPS) (style as any)[prop] = (computed as any)[prop];

  style.position = 'absolute';
  style.top = '0';
  style.left = '0';
  style.visibility = 'hidden';
  style.pointerEvents = 'none';
  style.whiteSpace = 'pre-wrap';
  style.overflowWrap = 'break-word';
  style.overflow = 'hidden';
  // Tamanho fixo e contido: o layout do espelho não mexe no resto da página.
  style.contain = 'strict';

  mirror.borderTop = parseInt(computed.borderTopWidth, 10) || 0;
  mirror.borderLeft = parseInt(computed.borderLeftWidth, 10) || 0;
  mirror.stale = false;
}

function mirrorFor(textarea: HTMLTextAreaElement): Mirror | null {
  const parent = textarea.parentElement;

  if (!parent) return null;

  let mirror = mirrors.get(textarea);

  if (!mirror || mirror.div.parentElement !== parent) {
    const div = document.createElement('div');
    div.className = 'CanelaCaretMirror';
    div.setAttribute('aria-hidden', 'true');
    parent.appendChild(div);

    mirror = { div, stale: true, borderTop: 0, borderLeft: 0, memo: null };
    mirrors.set(textarea, mirror);
    watchResize(textarea);
  }

  if (mirror.stale) copyStyle(textarea, mirror);

  return mirror;
}

/** A posição (relativa ao campo, sem a rolagem) do caractere `position`. */
function measure(textarea: HTMLTextAreaElement, position: number): { top: number; left: number } | null {
  const mirror = mirrorFor(textarea);

  if (!mirror) return null;

  const before = textarea.value.substring(0, position);
  const key = before + '\u0000' + (/^\S*/.exec(textarea.value.substring(position))?.[0] || '');

  if (mirror.memo && mirror.memo.key === key) return mirror.memo;

  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position) || '.';

  mirror.div.textContent = before;
  mirror.div.appendChild(span);

  const result = { key, top: span.offsetTop + mirror.borderTop, left: span.offsetLeft + mirror.borderLeft };
  mirror.memo = result;

  return result;
}

export default function installCaret(): void {
  override('flarum/common/utils/BasicEditorDriver', 'getCaretCoordinates', function (this: any, original: (position: number) => any, position: any) {
    const textarea: HTMLTextAreaElement | undefined = this.el;

    if (!(textarea instanceof HTMLTextAreaElement)) return original(position);

    try {
      const coords = measure(textarea, Number(position));

      if (coords) return { top: coords.top - textarea.scrollTop, left: coords.left };
    } catch {
      // Qualquer surpresa: a conta do core.
    }

    return original(position);
  });
}
