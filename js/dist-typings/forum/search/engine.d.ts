import { type CanelaTag } from '../utils/tags';
import type { SearchMenuState } from './state';
/** Quantos itens o menu mostra por tipo. */
export declare const PER_FACET = 5;
/** Minúsculas e sem acentos: "Notícias" casa com "noticias". */
export declare function normalize(value: string): string;
/** Categoria = tag primária ou filha de uma (como na página de busca do tema). */
export declare function isCategory(tag: CanelaTag): boolean;
export declare function trigger(state: SearchMenuState): void;
