/*
 * Os textos do menu do usuário que o pacote principal usa (o botão do
 * cabeçalho, a aba do perfil). O menu em si é um chunk sob demanda.
 */
import app from 'flarum/forum/app';

/** Tradução do menu, como texto (title, aria-label). */
export function umText(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`ramon-canela.forum.usermenu.${key}`, params, true) as string;
}
