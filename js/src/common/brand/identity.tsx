/*
 * A identidade visual gerada pelo nome do fórum.
 *
 * Do nome saem as iniciais (o monograma) e uma semente: a semente escolhe a
 * forma do selo, o padrão gráfico, o detalhe na segunda cor e a posição de
 * cada peça das artes. As cores não saem daqui: tudo pinta com variáveis do
 * CSS derivadas da cor primária (less/common/Brand.less), então o claro, o
 * escuro e a troca de cor no admin valem na hora. Mesmo nome, mesma
 * identidade; trocou o nome (ou a "variação" no admin), troca tudo.
 *
 * Fica em common: o fórum desenha as artes e o admin mostra a prévia.
 */
import type Mithril from 'mithril';

export type BrandArea = 'header' | 'welcome' | 'empty' | 'auth';

const SHAPES = ['circle', 'squircle', 'arch', 'leaf', 'blob', 'flower'] as const;
const PATTERNS = ['dots', 'rings', 'waves', 'stripes', 'confetti'] as const;

export type Shape = (typeof SHAPES)[number];
export type Pattern = (typeof PATTERNS)[number];

export interface Identity {
  initials: string;
  seed: number;
  shape: Shape;
  pattern: Pattern;
  /** Quantos graus a segunda cor anda no círculo cromático a partir da primária. */
  hue: number;
  /** Onde o detalhe na segunda cor encosta no selo (graus). */
  spark: number;
}

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

export function identity(name: string, variant = 0): Identity {
  const clean = name.trim().replace(/\s+/g, ' ') || 'Flarum';
  const seed = hash(`${clean.toLocaleLowerCase()}#${variant}`);
  const rand = random(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

  return {
    initials: initialsOf(clean),
    seed,
    shape: pick(SHAPES),
    pattern: pick(PATTERNS),
    // Longe o bastante da primária para contrastar, perto o bastante para combinar.
    hue: Math.round(35 + rand() * 110) * (rand() < 0.5 ? -1 : 1),
    spark: Math.round(rand() * 360),
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Curva fechada e suave pelos pontos (Catmull-Rom em Béziers). */
function closedCurve(points: [number, number][]): string {
  const n = points.length;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;

  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]];

    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }

  return `${d}Z`;
}

/** O contorno do selo, num quadrado de 100 × 100. */
export function shapePath(id: Identity): string {
  switch (id.shape) {
    case 'circle':
      return 'M50 8a42 42 0 1 1 0 84a42 42 0 1 1 0-84Z';
    case 'squircle':
      return 'M50 8C84 8 92 16 92 50S84 92 50 92 8 84 8 50 16 8 50 8Z';
    case 'arch':
      return 'M14 92V50a36 36 0 0 1 72 0v42Z';
    case 'leaf':
      return 'M8 50A42 42 0 0 1 50 8h42v42a42 42 0 0 1-42 42H8Z';
    case 'flower': {
      const points: [number, number][] = [];

      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 37 : 44;
        points.push([50 + r * Math.cos(angle), 50 + r * Math.sin(angle)]);
      }

      return closedCurve(points);
    }
    default: {
      const rand = random(id.seed ^ 0x9e3779b9);
      const points: [number, number][] = [];

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + rand() * 0.4;
        const r = 36 + rand() * 8;
        points.push([50 + r * Math.cos(angle), 50 + r * Math.sin(angle)]);
      }

      return closedCurve(points);
    }
  }
}

/** O selo (forma + iniciais + o detalhe), como grupo dentro de um SVG maior. */
function sealGroup(id: Identity, x: number, y: number, size: number, extra: Record<string, any> = {}): Mithril.Children {
  const angle = (id.spark * Math.PI) / 180;
  const two = Array.from(id.initials).length > 1;

  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(size / 100) || 1})`} {...extra}>
      <g className="CanelaBrand-seal">
        <path className="CanelaBrand-shape" d={shapePath(id)} />
        <circle className="CanelaBrand-spark" cx={f(50 + 34 * Math.cos(angle))} cy={f(50 + 34 * Math.sin(angle))} r="8" />
        <text className="CanelaBrand-initials" x="50" y={id.shape === 'arch' ? 58 : 51} font-size={two ? 36 : 46}>
          {id.initials}
        </text>
      </g>
    </g>
  );
}

/** O monograma sozinho (cabeçalho, favicon da prévia). */
export function brandMark(id: Identity, attrs: Record<string, any> = {}): Mithril.Children {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      {...attrs}
      className={`CanelaBrand CanelaBrand--mark ${attrs.className || ''}`}
      style={{ '--cn-brand-hue': id.hue }}
    >
      {sealGroup(id, 0, 0, 100)}
    </svg>
  );
}

let uid = 0;

/** O padrão gráfico da identidade, numa área de `w` × `h`. */
function patternGroup(id: Identity, w: number, h: number): Mithril.Children {
  const rand = random(id.seed ^ 0x51f15e);
  const items: Mithril.Children[] = [];

  switch (id.pattern) {
    case 'dots': {
      const gap = 14 + Math.round(rand() * 8);
      const r = f(1.4 + rand() * 1.2);

      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) items.push(<circle cx={f(x)} cy={f(y)} r={r} />);
      }
      break;
    }
    case 'rings': {
      const cx = rand() < 0.5 ? 0 : w;
      const cy = rand() < 0.5 ? 0 : h;
      const step = 14 + Math.round(rand() * 6);

      for (let r = step; r < Math.hypot(w, h); r += step) items.push(<circle cx={cx} cy={cy} r={r} fill="none" />);
      break;
    }
    case 'waves': {
      const gap = 16 + Math.round(rand() * 6);
      const amp = 3 + rand() * 3;
      const len = 40 + rand() * 30;

      for (let y = gap / 2; y < h + amp; y += gap) {
        let d = `M0 ${f(y)}`;
        for (let x = 0; x < w; x += len) d += `q${f(len / 4)} ${f(-amp * 2)} ${f(len / 2)} 0t${f(len / 2)} 0`;
        items.push(<path d={d} fill="none" />);
      }
      break;
    }
    case 'stripes': {
      const gap = 12 + Math.round(rand() * 6);
      const tilt = (rand() < 0.5 ? 1 : -1) * (h * 0.6);

      for (let x = -Math.abs(tilt); x < w + Math.abs(tilt); x += gap) items.push(<path d={`M${f(x)} 0l${f(tilt)} ${h}`} fill="none" />);
      break;
    }
    default: {
      for (let i = 0; i < Math.round((w * h) / 1400); i++) {
        const x = f(rand() * w);
        const y = f(rand() * h);
        const kind = rand();
        const turn = Math.round(rand() * 90);

        if (kind < 0.4) items.push(<circle cx={x} cy={y} r="2.6" />);
        else if (kind < 0.75) items.push(<rect x={x} y={y} width="5" height="5" rx="1" transform={`rotate(${turn} ${x} ${y})`} />);
        else items.push(<path d={`M${x - 4} ${y}h8M${x} ${y - 4}v8`} fill="none" />);
      }
    }
  }

  return <g className={`CanelaBrand-pattern CanelaBrand-pattern--${id.pattern}`}>{items}</g>;
}

/** Peças soltas em volta do selo: posições da semente, fora do miolo. */
function confetti(id: Identity, w: number, h: number, count: number, avoid: [number, number, number]): Mithril.Children[] {
  const rand = random(id.seed ^ 0xc0ff1e);
  const pieces: Mithril.Children[] = [];

  for (let tries = 0; pieces.length < count && tries < 80; tries++) {
    const x = 12 + rand() * (w - 24);
    const y = 12 + rand() * (h - 24);

    if (Math.hypot(x - avoid[0], y - avoid[1]) < avoid[2]) continue;

    const size = 4 + rand() * 6;
    const tone = pieces.length % 2 ? 'b' : 'a';
    const delay = `${f(-rand() * 6)}s`;
    const shape =
      pieces.length % 3 === 0 ? (
        <circle cx={f(x)} cy={f(y)} r={f(size / 2)} />
      ) : pieces.length % 3 === 1 ? (
        <rect
          x={f(x - size / 2)}
          y={f(y - size / 2)}
          width={f(size)}
          height={f(size)}
          rx={f(size / 4)}
          transform={`rotate(${Math.round(rand() * 90)} ${f(x)} ${f(y)})`}
        />
      ) : (
        <path d={`M${f(x - size / 2)} ${f(y)}h${f(size)}M${f(x)} ${f(y - size / 2)}v${f(size)}`} />
      );

    pieces.push(
      <g className={`CanelaBrand-float CanelaBrand-piece CanelaBrand-piece--${tone}`} style={{ animationDelay: delay }}>
        {shape}
      </g>
    );
  }

  return pieces;
}

/** Um balão de conversa (o fórum é conversa) com três pontos ou linhas. */
function bubble(x: number, y: number, w: number, tone: 'a' | 'b' | 'soft', flip: boolean, lines: boolean): Mithril.Children {
  const h = Math.round(w * 0.6);
  const tail = flip ? `M${x + w - 14} ${y + h - 1}l6 10 2-10` : `M${x + 12} ${y + h - 1}l-2 10 8-10`;

  return (
    <g className={`CanelaBrand-bubble CanelaBrand-bubble--${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx={h / 2.4} />
      <path d={tail} />
      {lines
        ? [
            <rect className="CanelaBrand-bubbleInk" x={x + 12} y={y + h * 0.32} width={w - 24} height="4" rx="2" />,
            <rect className="CanelaBrand-bubbleInk" x={x + 12} y={y + h * 0.58} width={(w - 24) * 0.6} height="4" rx="2" />,
          ]
        : [0, 1, 2].map((i) => <circle className="CanelaBrand-bubbleInk" cx={x + w / 2 + (i - 1) * 10} cy={y + h / 2} r="3" />)}
    </g>
  );
}

/** A arte de uma área do fórum. */
export function brandScene(id: Identity, area: Exclude<BrandArea, 'header'>, attrs: Record<string, any> = {}): Mithril.Children {
  const clip = `cnb-${id.seed.toString(36)}-${area}-${uid++}`;
  const [w, h] = area === 'auth' ? [400, 320] : area === 'empty' ? [240, 150] : [320, 200];
  const [cx, cy] = [w / 2, h / 2];
  let body: Mithril.Children;

  if (area === 'empty') {
    // A lista vazia: o selo só no contorno tracejado, esperando o primeiro tópico.
    body = [
      <ellipse className="CanelaBrand-ground" cx={cx} cy={h - 14} rx="70" ry="7" />,
      <g transform={`translate(${cx - 44} ${cy - 52}) scale(.88)`}>
        <path className="CanelaBrand-outline" d={shapePath(id)} />
        <text
          className="CanelaBrand-initials CanelaBrand-initials--muted"
          x="50"
          y={id.shape === 'arch' ? 58 : 51}
          font-size={Array.from(id.initials).length > 1 ? 36 : 46}
        >
          {id.initials}
        </text>
      </g>,
      ...confetti(id, w, h - 20, 5, [cx, cy - 8, 62]),
    ];
  } else if (area === 'auth') {
    // O painel de entrar: o padrão cobrindo, o selo grande e uma órbita.
    body = [
      <clipPath id={clip}>
        <rect width={w} height={h} rx="24" />
      </clipPath>,
      <g clip-path={`url(#${clip})`}>{patternGroup(id, w, h)}</g>,
      <g className="CanelaBrand-orbit">
        <circle className="CanelaBrand-orbitPath" cx={cx} cy={cy} r="118" />
        <circle className="CanelaBrand-piece--a" cx={cx + 118} cy={cy} r="7" />
        <circle className="CanelaBrand-piece--b" cx={cx - 118} cy={cy} r="5" />
      </g>,
      sealGroup(id, cx - 70, cy - 70, 140, { className: 'CanelaBrand-pop' }),
      bubble(cx + 52, cy - 104, 64, 'b', false, false),
    ];
  } else {
    // Boas-vindas: o selo no meio de uma conversa.
    body = [
      <clipPath id={clip}>
        <path
          d={closedCurve([
            [30, 100],
            [80, 22],
            [190, 12],
            [292, 56],
            [300, 150],
            [210, 192],
            [70, 180],
          ])}
        />
      </clipPath>,
      <path
        className="CanelaBrand-backdrop"
        d={closedCurve([
          [30, 100],
          [80, 22],
          [190, 12],
          [292, 56],
          [300, 150],
          [210, 192],
          [70, 180],
        ])}
      />,
      <g clip-path={`url(#${clip})`}>{patternGroup(id, w, h)}</g>,
      ...confetti(id, w, h, 5, [cx, cy, 78]),
      bubble(42, 34, 62, 'b', true, false),
      bubble(216, 118, 72, 'soft', false, true),
      sealGroup(id, cx - 56, cy - 56, 112, { className: 'CanelaBrand-pop' }),
    ];
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      {...attrs}
      className={`CanelaBrand CanelaBrand--${area} ${attrs.className || ''}`}
      style={{ '--cn-brand-hue': id.hue }}
    >
      {body}
    </svg>
  );
}
