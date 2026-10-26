import type Mithril from 'mithril';
export type ViewsHeat = 'low' | 'med' | 'high' | null;
/** Os padrões, quando o fórum ainda não serializou as faixas. */
export declare const VIEWS_HEAT_DEFAULTS: {
    low: number;
    medium: number;
    high: number;
};
/** A janela de uma visualização, em horas (8 por padrão): entra no texto do gráfico. */
export declare function viewDurationHours(): number;
/** Casas fixas, com o separador do idioma. */
export declare function localNumber(value: number, precision?: number): string;
/**
 * O número curto, passo a passo: arredonda, acima de 999.999 vira
 * milhões com uma casa ("1,0M" — a casa zero fica), acima de 99.999
 * milhares sem casa ("120k", truncado), acima de 999 milhares com uma casa
 * ("1,2k"). `maxDisplay` corta em "50+".
 */
export declare function formatViews(value: number | string | null | undefined, options?: {
    maxDisplay?: number;
}): string;
/** "este tópico foi visto 1.234 vezes" (`views_long`). */
export declare function viewsTitle(count: number): string;
/** "visualização" / "visualizações" (`views_lowercase`), o rótulo do mapa do tópico. */
export declare function viewsLabel(count: number): string;
/** O calor das visualizações, com as faixas do admin. */
export declare function viewsHeat(count: number): ViewsHeat;
/**
 * O `{{dNumber views numberKey="views_long"}}`: o número abreviado num
 * `<span class="number">`, com o title por extenso só quando ele diz algo a
 * mais que o número (sempre, com o `views_long`). `noTitle` é o do mapa do
 * tópico, que já escreve "visualizações" ao lado.
 */
export declare function viewsNumber(count: number, options?: {
    noTitle?: boolean;
    className?: string;
}): Mithril.Vnode;
