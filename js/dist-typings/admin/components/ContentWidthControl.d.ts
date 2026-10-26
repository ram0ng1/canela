import { AdminComponent, type LooseAttrs } from '../util';
import type Mithril from 'mithril';
/**
 * Largura do cartão de conteúdo (--cn-main-max): opções prontas (padrão,
 * largo, 90%, largura toda) ou um valor manual em px, com a prévia do fórum
 * real numa tela de 1440px.
 */
export default class ContentWidthControl extends AdminComponent {
    /** "1110", "1280"… (px) ou "90%" / "100%". */
    value: string;
    custom: boolean;
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    page: 'index' | 'discussion';
    discussionPath: string | null;
    frame: HTMLIFrameElement | null;
    loaded: boolean;
    oninit(vnode: Mithril.Vnode<LooseAttrs, this>): void;
    previewUrl(): string | null;
    /** Reduz a "tela" de 1440px à largura disponível. */
    fit(box: HTMLElement): void;
    /** Aplica a largura escolhida dentro do fórum da prévia. */
    apply(): void;
    cssValue(): string;
    view(): JSX.Element;
    set(value: string): void;
}
