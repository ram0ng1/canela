/*
 * O tamanho mínimo do termo de busca, o mesmo no menu do cabeçalho e na
 * página de busca: 2 caracteres. O core pede 3, pouco para chinês, japonês e
 * coreano, em que duas letras (às vezes uma) já formam uma palavra; com o modo
 * CJK do core ligado (`search_cjk_mode`), vale o 1 dele.
 */
import SearchManager from 'flarum/common/SearchManager';

const MIN_TERM_LENGTH = 2;

export function minTermLength(): number {
  return Math.min(MIN_TERM_LENGTH, SearchManager.minSearchLength());
}

/** O termo tem caracteres suficientes (contados um a um, e não em unidades do UTF-16). */
export function termLongEnough(term: string): boolean {
  return [...term.trim()].length >= minTermLength();
}
