/*
 * Os textos do menu do usuário que o pacote principal usa (o botão do
 * cabeçalho, a aba do perfil). O menu em si é um chunk sob demanda.
 */
import { t } from '../utils/settings';

/** Tradução do menu, como texto (title, aria-label); as sem parâmetros ficam guardadas, como as do `t`. */
export function umText(key: string, params: Record<string, unknown> = {}): string {
  return t(`usermenu.${key}`, params);
}
