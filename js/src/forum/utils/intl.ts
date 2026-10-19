/*
 * Formatadores do Intl guardados, um por idioma e opções: criar um
 * `Intl.DateTimeFormat`/`NumberFormat` é caro (carrega os dados do idioma), e
 * as datas e números da lista, do tópico e do perfil eram formatados criando
 * um novo a cada chamada, em todo redesenho. O idioma da página não muda
 * depois de carregada, então os formatadores valem até ela ser recarregada.
 */
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.DisplayNames>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.DisplayNames>(
  kind: string,
  locale: string | string[] | undefined,
  options: object,
  make: () => T
): T {
  const key = `${kind}|${String(locale)}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as T | undefined;

  if (!formatter) {
    formatter = make();
    cache.set(key, formatter);
  }

  return formatter;
}

export function dateFormat(locale: string | string[] | undefined, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  return cached('date', locale, options, () => new Intl.DateTimeFormat(locale, options));
}

export function numberFormat(locale: string | string[] | undefined, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return cached('number', locale, options, () => new Intl.NumberFormat(locale, options));
}

export function displayNames(locale: string | string[] | undefined, options: Intl.DisplayNamesOptions): Intl.DisplayNames {
  return cached('names', locale, options, () => new Intl.DisplayNames(locale, options));
}
