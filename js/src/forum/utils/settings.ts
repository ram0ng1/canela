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

/**
 * As traduções sem parâmetros já prontas: o idioma não muda com a página
 * aberta, e o formatador de mensagens do Flarum (ICU) refazia cada rótulo em
 * todo redesenho (centenas por página).
 */
const plainTexts = new Map<string, string>();

/** Atalho para a tradução do tema já como string (títulos, aria-label…). */
export function t(key: string, params: Record<string, unknown> = {}): string {
  const plain = Object.keys(params).length === 0;

  if (plain) {
    const cached = plainTexts.get(key);

    if (cached !== undefined) return cached;
  }

  const text = app.translator.trans(`ramon-canela.forum.${key}`, params, true) as string;

  // Só guarda o que achou: antes de as traduções carregarem, a chave volta crua.
  if (plain && text !== `ramon-canela.forum.${key}`) plainTexts.set(key, text);

  return text;
}

export function isExtensionEnabled(id: string): boolean {
  return id in flarum.extensions;
}
