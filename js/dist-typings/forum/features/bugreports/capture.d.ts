import { type Rect } from './context';
/** Baixa a biblioteca e embute as fontes antes do clique (o menu do botão chama isto). */
export declare function warm(): Promise<string>;
/** A área marcada, em PNG (nítido para texto). */
export declare function captureArea(rect: Rect): Promise<string>;
/** A tela inteira, em JPEG (bem menor que o PNG, e boa o bastante como referência). */
export declare function captureScreen(scale?: number): Promise<string>;
