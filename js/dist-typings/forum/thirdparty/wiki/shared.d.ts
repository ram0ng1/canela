/** O prefixo das rotas da wiki (linkrobins-wiki.index, .show, .compose, .edit). */
export declare const WIKI_ROUTE_PREFIX = "linkrobins-wiki.";
/** Atributo que a wiki publica no fórum (null quando a extensão não o manda). */
export declare function wikiAttr<T = unknown>(name: string): T | null;
/** Tradução da própria wiki (as chaves `linkrobins-wiki.forum.*`), já como texto. */
export declare function wt(key: string, fallback: string, params?: Record<string, unknown>): string;
/** O endereço da wiki (o basePath já vem no app.route). */
export declare function wikiIndexUrl(params?: Record<string, unknown>): string;
/** Endereço canônico do artigo: o slug, quando há; senão o id (o servidor aceita os dois). */
export declare function wikiArticleUrl(article: any): string;
/** A rota atual é uma das da wiki (índice, artigo, novo ou edição). */
export declare function onWikiRoute(): boolean;
/** As mesmas regras de permissions.ts da wiki: o admin sempre pode. */
export declare const wikiCan: {
    create: () => boolean;
    edit: () => boolean;
    history: () => boolean;
};
/**
 * Onde o link "Wiki" entra na seção da comunidade, pela opção da própria
 * wiki ("Posição do link"). Tópicos tem 100, Meus rascunhos 99, o Chat do
 * ramon/chat 90, Minhas postagens 60 e "Mais" -100. null: o admin escolheu
 * não mostrar o link.
 */
export declare function wikiNavPriority(): number | null;
