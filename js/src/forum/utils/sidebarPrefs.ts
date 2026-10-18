/*
 * Quais categorias e etiquetas o leitor escolheu para a barra lateral — o
 * "personalizar seção" do Discourse. Fica no localStorage, por usuário: a
 * escolha é uma preferência de leitura, não um dado que precise ir ao servidor.
 * Sem escolha (null), a seção mostra o padrão do fórum.
 */
import app from 'flarum/forum/app';

export type SidebarSectionName = 'categories' | 'tags';

function storageKey(section: SidebarSectionName): string {
  return `canela.sidebarPicks.${app.session.user?.id() ?? 'guest'}.${section}`;
}

export function getSidebarPicks(section: SidebarSectionName): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(section));
    const parsed = raw ? JSON.parse(raw) : null;

    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function setSidebarPicks(section: SidebarSectionName, ids: string[] | null): void {
  try {
    if (ids === null) localStorage.removeItem(storageKey(section));
    else localStorage.setItem(storageKey(section), JSON.stringify(ids));
  } catch {
    // Sem armazenamento a escolha vale só até recarregar a página.
  }
}
