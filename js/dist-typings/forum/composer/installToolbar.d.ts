export interface MoreAction {
    icon: string;
    label: string;
    onclick: (e?: MouseEvent) => void;
    active?: boolean;
}
/**
 * Os dois modos do alternador "M↓ | A", lembrados no navegador:
 * - "A" (padrão): o composer estreito, da largura do tópico, sem a prévia ao
 *   lado e só com tela cheia/minimizar/fechar no canto. O Flarum não tem
 *   editor rico; o texto continua sendo escrito no mesmo campo.
 * - Markdown: a largura toda, a prévia ao lado (o « no canto a esconde).
 */
export declare function richMode(): boolean;
export declare function setPlaceholderProvider(provider: (rich: boolean) => string): void;
export declare function setRichMode(value: boolean): void;
export declare function addMoreAction(provider: () => (MoreAction & {
    key: string;
}) | null): void;
export default function installToolbar(): void;
