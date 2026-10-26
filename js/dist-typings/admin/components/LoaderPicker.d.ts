import { AdminComponent } from '../util';
export default class LoaderPicker extends AdminComponent {
    /** O SVG que está no campo (ainda não aplicado), ou `null` = o gravado. */
    draft: string | null;
    error: string | null;
    view(): JSX.Element;
    stageStyle(color: string): Record<string, string>;
    /** O desenho de um estilo, do tamanho pedido. */
    sample(key: string, custom: string, size?: number): any;
    customFields(custom: string): JSX.Element;
    colorField(color: string): JSX.Element;
    /** Grande, médio e dentro de um botão, no tamanho escolhido. */
    preview(style: string, custom: string, color: string): JSX.Element;
    choose(style: string): void;
    save(key: string, value: string): Promise<unknown>;
    applyCustom(svg: string): void;
    upload(input: HTMLInputElement): void;
}
