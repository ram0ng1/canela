/** `#slug` no fim do termo: o assistente lista categorias e etiquetas. */
export declare const CATEGORY_SLUG_REGEXP: RegExp;
/** `@nome` no fim do termo: o assistente lista usuários. */
export declare const USERNAME_REGEXP: RegExp;
/** `algo:` no fim do termo: o assistente lista os filtros (gambits). */
export declare const SUGGESTIONS_REGEXP: RegExp;
/** O termo já tem um modificador: a primeira linha não repete "em todos os tópicos". */
export declare const MODIFIER_REGEXP: RegExp;
/** A chave traduzida de um gambit do core ou de uma extensão, pelo filtro que ele gera. */
export declare function gambitKey(filterKey: string): string | null;
/**
 * "tema #suporte @ana" -> "tema tag:suporte autor:ana": o Flarum não
 * conhece esses atalhos, mas conhece os gambits (com as chaves no
 * idioma do fórum), que a busca do core e a página de busca já entendem.
 */
export declare function toGambitQuery(term: string): string;
/** O filtro da API para o termo, e o texto livre que sobra (o que se destaca nos resultados). */
export declare function discussionFilter(term: string): {
    filter: Record<string, any>;
    text: string;
};
/** A busca de página inteira: a página de busca do tema ou, sem ela, a lista do core com `?q=`. */
export declare function fullSearchUrl(term: string): string;
/** O botão dos controles deslizantes só existe com a página de busca avançada. */
export declare function advancedSearchAvailable(): boolean;
