/*
 * O contexto que vai com cada relatório: a página, a tela, os elementos sob a
 * área marcada e (se o admin ligou) os erros recentes do console.
 *
 * Adaptado do Bugframe (github.com/vmatheus3/bug-frame, src/widget/context.ts),
 * MIT, © 2026 vmatheus3 e colaboradores.
 */
import { recentConsoleErrors, UI_ATTR, type ConsoleEntry } from './console';

export { UI_ATTR };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementInfo {
  path: string;
  component: string;
  text: string;
}

export interface ReportContext {
  url: string;
  title: string;
  viewport: { w: number; h: number; dpr: number };
  region: Rect | null;
  userAgent: string;
  language: string;
  route: string;
  theme: string;
  elements: ElementInfo[];
  consoleErrors: ConsoleEntry[];
}

const cssEscape = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));

/** O nome do componente mais próximo, pelos `data-*` dos ancestrais. */
function componentName(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    for (const attr of ['data-component', 'data-screen', 'data-testid', 'data-id']) {
      const value = node.getAttribute(attr);

      if (value) return `${attr.slice(5)}:${value}`;
    }
  }

  return '';
}

function domPath(el: Element): string {
  const parts: string[] = [];

  for (let node: Element | null = el; node && node !== document.body && parts.length < 6; node = node.parentElement) {
    const cls = (typeof node.className === 'string' ? node.className : '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((c) => `.${cssEscape(c)}`)
      .join('');

    parts.unshift(`${node.tagName.toLowerCase()}${node.id ? `#${cssEscape(node.id)}` : ''}${cls}`);
  }

  return parts.join(' > ');
}

/** Os elementos sob o centro e os quatro quartos da área, do mais específico. */
function describeElements(rect: Rect): ElementInfo[] {
  const points = [
    [0.5, 0.5],
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
  ].map(([fx, fy]) => [rect.x + rect.w * fx, rect.y + rect.h * fy] as const);
  const seen = new Set<Element>();
  const out: ElementInfo[] = [];

  for (const [x, y] of points) {
    const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];

    for (const el of stack) {
      if (el === document.documentElement || el === document.body || el.closest(`[${UI_ATTR}]`) || seen.has(el)) continue;

      seen.add(el);

      // Campos de senha não dão texto.
      const secret = !!el.closest('input[type="password"], [data-bug-mask]');

      if (out.length < 8) {
        out.push({
          path: domPath(el),
          component: componentName(el),
          text: secret ? '' : (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
        });
      }

      break;
    }
  }

  return out;
}

const REDACT = [
  'token',
  'access_token',
  'id_token',
  'key',
  'apikey',
  'api_key',
  'password',
  'passwd',
  'secret',
  'auth',
  'code',
  'session',
  'sid',
  'jwt',
  'signature',
  'sig',
];

/** A URL sem os parâmetros que costumam carregar segredos. */
export function redactUrl(href: string): string {
  try {
    const url = new URL(href);

    for (const key of Array.from(url.searchParams.keys())) {
      if (REDACT.includes(key.toLowerCase())) url.searchParams.set(key, '[redacted]');
    }

    url.searchParams.delete('bugs');

    return url.toString();
  } catch {
    return href.slice(0, 1000);
  }
}

export function buildContext(region: Rect | null, includeConsole: boolean, route: string): ReportContext {
  const root = document.documentElement;

  return {
    url: redactUrl(window.location.href),
    title: document.title.slice(0, 200),
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    region,
    userAgent: navigator.userAgent,
    language: navigator.language,
    route,
    theme: root.getAttribute('data-theme') || (root.classList.contains('dark') ? 'dark' : ''),
    elements: region ? describeElements(region) : [],
    consoleErrors: includeConsole ? recentConsoleErrors() : [],
  };
}
