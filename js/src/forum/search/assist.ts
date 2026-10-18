/*
 * O que só o painel aberto do menu de busca usa (chunk do SearchPanel): as
 * buscas recentes, as dicas aleatórias e os atalhos do assistente.
 */
import app from 'flarum/forum/app';
import { GambitType } from 'flarum/common/query/IGambit';
import type IGambit from 'flarum/common/query/IGambit';

import { t } from '../utils/settings';
import { isTagsEnabled } from '../utils/tags';
import { gambitKey } from './query';

const MAX_RECENT_SEARCHES = 5;

// ---------------------------------------------------------------------------
// Buscas recentes
// ---------------------------------------------------------------------------
// O Discourse guarda as buscas recentes no servidor (`log_search_queries`);
// aqui elas ficam no navegador, por usuário: é uma conveniência de quem
// pesquisa, e não um dado do fórum.

function recentKey(): string | null {
  const user = app.session.user;

  return user ? `canela.recentSearches.${user.id()}` : null;
}

export function recentSearches(): string[] {
  const key = recentKey();

  if (!key) return [];

  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');

    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const key = recentKey();
  const clean = term.trim();

  if (!key || !clean) return;

  const list = [clean, ...recentSearches().filter((item) => item !== clean)].slice(0, MAX_RECENT_SEARCHES);

  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Sem armazenamento (janela anônima, cota): a busca segue sem histórico.
  }
}

export function clearRecentSearches(): void {
  const key = recentKey();

  if (!key) return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Idem.
  }
}

// ---------------------------------------------------------------------------
// Gambits como os atalhos do assistente ("in:title", "status:open" …)
// ---------------------------------------------------------------------------

function enabledGambits(): IGambit[] {
  return app.search.gambits.for('discussions').filter((gambit) => gambit.enabled());
}

function firstKey(key: string | string[]): string {
  return Array.isArray(key) ? key[0] : key;
}

/** Os grupos booleanos ("é:", "em:") com as chaves de cada um. */
function groupedKeys(): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  enabledGambits()
    .filter((gambit) => gambit.type === GambitType.Grouped)
    .forEach((gambit) => {
      const { group, key } = gambit.suggestion() as { group: string; key: string | string[] };
      const list = groups.get(group) || [];

      list.push(firstKey(key));
      groups.set(group, list);
    });

  return groups;
}

/**
 * Todos os atalhos, na ordem em que o Discourse os lista: primeiro os
 * booleanos já completos ("é:fixada"), depois as chaves que pedem um valor
 * ("criado:") — exceto autor e tag, que já têm `@` e `#`.
 */
export function suggestionShortcuts(): string[] {
  const shortcuts: string[] = [];

  groupedKeys().forEach((keys, group) => keys.forEach((key) => shortcuts.push(`${group}:${key}`)));

  enabledGambits()
    .filter((gambit) => gambit.type === GambitType.KeyValue && !['author', 'tag'].includes(gambit.filterKey()))
    .forEach((gambit) => shortcuts.push(`${firstKey((gambit as any).key())}:`));

  return shortcuts;
}

// ---------------------------------------------------------------------------
// Dicas aleatórias (`.search-random-quick-tip`)
// ---------------------------------------------------------------------------

export interface QuickTip {
  label?: string;
  shortcut?: boolean;
  description: string;
  clickable?: boolean;
}

/** Uma dica de atalho de teclado não ajuda quem não tem teclado. */
function hasKeyboard(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function quickTips(): QuickTip[] {
  const tips: QuickTip[] = [];

  if (isTagsEnabled() && gambitKey('tag')) tips.push({ label: '#', description: t('search_menu.tips.category_tag'), clickable: true });
  if (gambitKey('author')) tips.push({ label: '@', description: t('search_menu.tips.author'), clickable: true });

  groupedKeys().forEach((keys, group) => {
    const examples = keys
      .slice(0, 3)
      .map((key) => `${group}:${key}`)
      .join(', ');

    tips.push({ label: `${group}:`, description: t('search_menu.tips.in', { examples }), clickable: true });
  });

  if (hasKeyboard()) tips.push({ shortcut: true, description: t('search_menu.tips.full_search') });

  return tips;
}

export function randomTip(): QuickTip | null {
  const tips = quickTips();

  return tips.length ? tips[Math.floor(Math.random() * tips.length)] : null;
}
