import type Mithril from 'mithril';
export declare function preferred(): boolean;
export declare function setPreferred(value: boolean): void;
/**
 * O composer comporta as duas colunas agora: computador, aberto ou em tela
 * cheia. `app.screen()` diz "desktop-hd" a partir de 1200px — comparar só com
 * "desktop" deixava a prévia de fora justo nas telas largas. A altura não
 * conta: divide mesmo no composer mais baixo (255px).
 */
export declare function splitPossible(): boolean;
export declare function splitPreviewVisible(): boolean;
export default function installPreview(): void;
/**
 * O botão « da prévia: fica no canto do composer, antes
 * de tela cheia e minimizar. A seta gira (pelo CSS) quando a prévia está
 * escondida.
 */
export declare function previewToggle(): Mithril.Children;
