/*
 * O que a barra lateral (no forum.js) e as telas da wiki (no chunk ./pages)
 * dividem: os endereços, as rotas e as permissões que a linkrobins/wiki
 * publica no fórum. Fica num módulo pequeno para que nada fora do chunk
 * precise importar as telas.
 */
import app from 'flarum/forum/app';

/** O prefixo das rotas da wiki (linkrobins-wiki.index, .show, .compose, .edit). */
export const WIKI_ROUTE_PREFIX = 'linkrobins-wiki.';

/** Atributo que a wiki publica no fórum (null quando a extensão não o manda). */
export function wikiAttr<T = unknown>(name: string): T | null {
  try {
    return (app.forum?.attribute<T>(name) ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Tradução da própria wiki (as chaves `linkrobins-wiki.forum.*`), já como texto. */
export function wt(key: string, fallback: string, params: Record<string, unknown> = {}): string {
  const full = `linkrobins-wiki.forum.${key}`;
  const text = app.translator.trans(full, params, true) as string;

  return text && text !== full ? text : fallback;
}

/** O endereço da wiki (o basePath já vem no app.route). */
export function wikiIndexUrl(params: Record<string, unknown> = {}): string {
  return app.route('linkrobins-wiki.index', params);
}

/** Endereço canônico do artigo: o slug, quando há; senão o id (o servidor aceita os dois). */
export function wikiArticleUrl(article: any): string {
  let segment = '';

  try {
    segment = String(article?.slug?.() || article?.id?.() || '');
  } catch {
    segment = '';
  }

  return `${wikiIndexUrl()}/${encodeURIComponent(segment)}`;
}

/** A rota atual é uma das da wiki (índice, artigo, novo ou edição). */
export function onWikiRoute(): boolean {
  return String(app.current.get('routeName') || '').startsWith(WIKI_ROUTE_PREFIX);
}

function isAdmin(): boolean {
  return !!app.session.user?.isAdmin();
}

/** As mesmas regras de permissions.ts da wiki: o admin sempre pode. */
export const wikiCan = {
  create: () => !!app.session.user && (isAdmin() || !!wikiAttr('canCreateWikiArticle')),
  edit: () => !!app.session.user && (isAdmin() || !!wikiAttr('canEditWikiArticles')),
  history: () => isAdmin() || !!wikiAttr('canViewWikiHistory'),
};

/**
 * Onde o link "Wiki" entra na seção da comunidade, pela opção da própria
 * wiki ("Posição do link"). Tópicos tem 100, Meus rascunhos 99, o Chat do
 * ramon/chat 90, Minhas postagens 60 e "Mais" -100. null: o admin escolheu
 * não mostrar o link.
 */
export function wikiNavPriority(): number | null {
  const position = String(wikiAttr('linkrobinsWikiNavPosition') || 'sections');

  const priorities: Record<string, number> = {
    top: 101,
    below_all: 99.5,
    sections: 80,
    bottom: -90,
  };

  if (position === 'hidden') return null;

  return priorities[position] ?? priorities.sections;
}
