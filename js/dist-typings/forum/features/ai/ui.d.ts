import type Mithril from 'mithril';
/** "A IA está gerando conteúdo…" — os pontos sobem um depois do outro. */
export declare function indicatorWave(): Mithril.Children;
/**
 * Os blocos cinza do esqueleto. As larguras e a ordem ficam no CSS;
 * o ritmo (um bloco a cada 250 ms, depois o piscar em sequência)
 * fica todo no CSS, pelo índice de cada bloco.
 */
export declare function blinkingAnimation(): Mithril.Children;
export interface ToolActivity {
    tool: string;
    query?: string;
    results?: {
        id: string;
        title: string;
        url: string;
    }[];
    topic?: {
        id: string;
        title: string;
        url: string;
    } | null;
}
/**
 * O que o bot consultou, num `<details>` fechado acima da resposta:
 * "Pesquisou por "x" — 5 resultados", que abre
 * com os links; "Leu o tópico X".
 */
export declare function toolDetails(activities: ToolActivity[]): Mithril.Children;
