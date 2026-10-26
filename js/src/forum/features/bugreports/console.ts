/*
 * A parte do "Relatar problema" que fica no bundle principal: o atributo da
 * interface do recurso e a captura dos erros do console, que precisa começar
 * no carregamento da página para ter o que mandar. O resto do contexto fica
 * no chunk sob demanda (./context.ts).
 *
 * Adaptado do Bugframe (github.com/vmatheus3/bug-frame, src/widget/context.ts),
 * MIT, © 2026 vmatheus3 e colaboradores.
 */

export interface ConsoleEntry {
  at: string;
  message: string;
}

/** A interface do próprio recurso: nunca entra na captura nem no contexto. */
export const UI_ATTR = 'data-bug-ui';

const WINDOW_MS = 60_000;
let errors: { time: number; message: string }[] = [];
let installed = false;

function keep(message: string): void {
  const now = Date.now();

  errors = errors.filter((e) => now - e.time < WINDOW_MS).slice(-29);
  errors.push({ time: now, message: message.slice(0, 500) });
}

function show(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Passa a guardar os erros do console e as exceções do último minuto. */
export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;

  const original = console.error;

  console.error = (...args: unknown[]) => {
    try {
      keep(args.map(show).join(' '));
    } catch {
      // Nunca quebra a página.
    }

    original.apply(console, args as []);
  };

  window.addEventListener('error', (e) => keep(`${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`));
  window.addEventListener('unhandledrejection', (e) => keep(`Unhandled rejection: ${show(e.reason)}`));
}

export function recentConsoleErrors(): ConsoleEntry[] {
  const now = Date.now();

  return errors.filter((e) => now - e.time < WINDOW_MS).map((e) => ({ at: new Date(e.time).toISOString(), message: e.message }));
}
