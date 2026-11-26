/*
 * A identidade visual gerada pelo nome do fórum.
 *
 * Do nome saem as iniciais (o monograma) e uma semente, que escolhe a forma
 * do selo e um padrão de linhas finas. O admin pode fixar o modelo, a borda e
 * o efeito em volta, e trocar o monograma pelo logo do fórum. É de propósito pouco: uma forma, as
 * iniciais e uma textura discreta, numa cor só. A cor não sai daqui: tudo
 * pinta com variáveis do CSS derivadas da primária (less/common/Brand.less),
 * então o claro, o escuro e a troca de cor no admin valem na hora. Mesmo
 * nome, mesma identidade; trocou o nome (ou a "variação" no admin), troca.
 *
 * Fica em common: o fórum desenha as artes e o admin mostra a prévia.
 */
import type Mithril from 'mithril';

export type BrandArea = 'header' | 'welcome' | 'empty' | 'auth';

/** As formas e texturas que o nome sorteia (o admin ainda pode escolher outras). */
const SHAPES = ['circle', 'rounded', 'arch', 'leaf'] as const;
const PATTERNS = ['dots', 'lines', 'rings', 'grid'] as const;

export const SHAPE_CHOICES = ['circle', 'rounded', 'square', 'arch', 'leaf'] as const;
export const EFFECT_CHOICES = ['dots', 'lines', 'rings', 'grid', 'glow', 'none'] as const;
export const BORDER_CHOICES = ['fill', 'outline', 'ring'] as const;

export type Shape = (typeof SHAPE_CHOICES)[number];
export type Effect = (typeof EFFECT_CHOICES)[number];
export type Border = (typeof BORDER_CHOICES)[number];

export interface Identity {
  initials: string;
  seed: number;
  shape: Shape;
  effect: Effect;
  /** fill: selo cheio; outline: só o contorno; ring: cheio, com um anel fino em volta. */
  border: Border;
  /** O logo do fórum no lugar das iniciais, quando o admin pede. */
  logo: string | null;
}

/** O que o admin fixou; `auto` (ou vazio) deixa o nome escolher. */
export interface BrandChoices {
  shape?: string;
  effect?: string;
  border?: string;
  logo?: string | null;
}

const pickChoice = <T extends string>(list: readonly T[], value: string | undefined, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** Palavras que não viram inicial (quando sobra alguma outra). */
const FILLER = new Set('de da do das dos e a o the of and & la le el del di du des y fórum forum foro comunidade community comunidad'.split(' '));

function initialsOf(name: string): string {
  const words = name.split(/[\s\-_.·|:/]+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const meaningful = words.filter((word) => !FILLER.has(word.toLocaleLowerCase()));
  const use = meaningful.length ? meaningful : words;
  const first = (word: string) => Array.from(word).find((ch) => /[\p{L}\p{N}]/u.test(ch)) || '';

  if (!use.length) return '#';

  if (use.length === 1) {
    // "FlarumBR" → "FB": uma palavra só com maiúscula no meio vale por duas.
    const inner = Array.from(use[0])
      .slice(1)
      .find((ch) => /\p{Lu}/u.test(ch));

    return (first(use[0]) + (inner || '')).toLocaleUpperCase();
  }

  return (first(use[0]) + first(use[1])).toLocaleUpperCase();
}

/** FNV-1a de 32 bits: rápido, estável entre navegadores e bom para semente. */
function hash(text: string): number {
  let h = 0x811c9dc5;

  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

/** mulberry32: a sequência de números de uma semente, sempre a mesma. */
export function random(seed: number): () => number {
  let a = seed;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function identity(name: string, variant = 0, choices: BrandChoices = {}): Identity {
  const clean = name.trim().replace(/\s+/g, ' ') || 'Flarum';
  const seed = hash(`${clean.toLocaleLowerCase()}#${variant}`);
  const rand = random(seed);

  return {
    initials: initialsOf(clean),
    seed,
    shape: pickChoice(SHAPE_CHOICES, choices.shape, SHAPES[Math.floor(rand() * SHAPES.length)]),
    effect: pickChoice(EFFECT_CHOICES, choices.effect, PATTERNS[Math.floor(rand() * PATTERNS.length)]),
    border: pickChoice(BORDER_CHOICES, choices.border, 'fill'),
    logo: choices.logo || null,
  };
}

/** O contorno do selo, num quadrado de 100 × 100. */
export function shapePath(id: Identity): string {
  switch (id.shape) {
    case 'circle':
      return 'M50 6a44 44 0 1 1 0 88a44 44 0 1 1 0-88Z';
    case 'rounded':
      return 'M30 6h40a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H30A24 24 0 0 1 6 70V30A24 24 0 0 1 30 6Z';
    case 'square':
      return 'M14 6h72a8 8 0 0 1 8 8v72a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8Z';
    case 'arch':
      return 'M10 94V50a40 40 0 0 1 80 0v44Z';
    default:
      return 'M6 50A44 44 0 0 1 50 6h44v44a44 44 0 0 1-44 44H6Z';
  }
}

/** As iniciais, centradas no selo (no arco, um pouco abaixo: o miolo dele é mais baixo). */
function initials(id: Identity, muted = false): Mithril.Children {
  return (
    <text
      className={`CanelaBrand-initials${muted ? ' CanelaBrand-initials--muted' : ''}`}
      x="50"
      y={id.shape === 'arch' ? 56 : 51}
      font-size={Array.from(id.initials).length > 1 ? 36 : 44}
    >
      {id.initials}
    </text>
  );
}

/** O logo do fórum, inteiro, dentro do selo. */
function logoImage(id: Identity, inset: number): Mithril.Children {
  return <image href={id.logo!} x={inset} y={inset} width={100 - inset * 2} height={100 - inset * 2} preserveAspectRatio="xMidYMid meet" />;
}

/**
 * O selo, como grupo dentro de um SVG maior: a forma (cheia, só o contorno
 * ou com um anel em volta) e as iniciais, ou o logo do fórum. Com o logo, a
 * forma fica clara, para o logo de qualquer cor aparecer.
 */
function seal(id: Identity, x: number, y: number, size: number): Mithril.Children {
  const d = shapePath(id);
  const filled = id.border !== 'outline' && !id.logo;

  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      <g className="CanelaBrand-seal">
        {id.border === 'ring' && <path className="CanelaBrand-ring" d={d} transform="translate(-6 -6) scale(1.12)" />}
        <path className={filled ? 'CanelaBrand-shape' : 'CanelaBrand-frame'} d={d} />
        {id.logo ? logoImage(id, 20) : filled ? initials(id) : <g className="CanelaBrand-outlineInk">{initials(id)}</g>}
      </g>
    </g>
  );
}

/** O monograma sozinho (cabeçalho, prévia do admin). */
export function brandMark(id: Identity, attrs: Record<string, any> = {}): Mithril.Children {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" {...attrs} className={`CanelaBrand CanelaBrand--mark ${attrs.className || ''}`}>
      {seal(id, 0, 0, 100)}
    </svg>
  );
}

let uid = 0;

/** A textura da identidade: linhas e pontos finos, numa área de `w` × `h`. */
function pattern(id: Identity, w: number, h: number): Mithril.Children {
  const gap = 16 + Math.floor(random(id.seed ^ 0x51f15e)() * 3) * 4;
  const items: Mithril.Children[] = [];

  if (id.effect === 'dots') {
    for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) items.push(<circle cx={x} cy={y} r="1.3" />);
  } else if (id.effect === 'rings') {
    for (let r = gap; r < Math.hypot(w, h) / 2; r += gap) items.push(<circle cx={w / 2} cy={h / 2} r={r} fill="none" />);
  } else {
    for (let x = gap / 2; x < w; x += gap) items.push(<path d={`M${x} 0V${h}`} fill="none" />);
    if (id.effect === 'grid') for (let y = gap / 2; y < h; y += gap) items.push(<path d={`M0 ${y}H${w}`} fill="none" />);
  }

  return <g className="CanelaBrand-pattern">{items}</g>;
}

/** A arte de uma área do fórum: o selo sobre a textura, que some nas bordas. */
export function brandScene(id: Identity, area: Exclude<BrandArea, 'header'>, attrs: Record<string, any> = {}): Mithril.Children {
  const [w, h, size] = area === 'auth' ? [400, 320, 128] : area === 'empty' ? [240, 120, 72] : [320, 200, 96];
  const key = `cnb-${uid++}`;
  let body: Mithril.Children;

  if (area === 'empty') {
    // A lista vazia: só o contorno do selo, esperando o primeiro tópico.
    body = (
      <g transform={`translate(${(w - size) / 2} ${(h - size) / 2}) scale(${size / 100})`}>
        <path className="CanelaBrand-outline" d={shapePath(id)} />
        {id.logo ? <g opacity=".55">{logoImage(id, 22)}</g> : initials(id, true)}
      </g>
    );
  } else {
    body = [
      <defs>
        <radialGradient id={`${key}-g`}>
          <stop offset="0" stop-color="#fff" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id={`${key}-c`}>
          <stop className="CanelaBrand-glowStop" offset="0" />
          <stop className="CanelaBrand-glowStop" offset="1" stop-opacity="0" />
        </radialGradient>
        <mask id={`${key}-m`}>
          <rect width={w} height={h} fill={`url(#${key}-g)`} />
        </mask>
      </defs>,
      id.effect === 'glow' ? (
        <rect className="CanelaBrand-glow" width={w} height={h} fill={`url(#${key}-c)`} />
      ) : id.effect === 'none' ? null : (
        <g mask={`url(#${key}-m)`}>{pattern(id, w, h)}</g>
      ),
      <g className="CanelaBrand-pop">{seal(id, (w - size) / 2, (h - size) / 2, size)}</g>,
    ];
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      {...attrs}
      className={`CanelaBrand CanelaBrand--${area} ${attrs.className || ''}`}
    >
      {body}
    </svg>
  );
}
