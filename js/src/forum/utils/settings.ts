/*
 * Leitura das configurações do tema que o extend.php serializa no fórum
 * (`canela*`). O PHP já converte booleanos e inteiros, mas o atributo pode
 * faltar por um instante logo depois de ativar a extensão — daí os padrões.
 */
import app from 'flarum/forum/app';

export function forumBool(attributeName: string, fallback = false): boolean {
  // Nos initializers o `app.forum` ainda não existe: vale o padrão.
  if (!app.forum) return fallback;

  const value = app.forum.attribute<unknown>(attributeName);

  return value === undefined || value === null ? fallback : !!value;
}

export function forumInt(attributeName: string, fallback: number): number {
  if (!app.forum) return fallback;

  const value = Number(app.forum.attribute<unknown>(attributeName));

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** Atalho para a tradução do tema já como string (títulos, aria-label…). */
export function t(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`ramon-canela.forum.${key}`, params, true) as string;
}

export function isExtensionEnabled(id: string): boolean {
  return id in flarum.extensions;
}
