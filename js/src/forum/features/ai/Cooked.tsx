/*
 * Texto da IA desenhado como um post: o Markdown passa pelo mesmo formatador
 * do fórum (o s9e TextFormatter que o core carrega para a prévia do editor),
 * então links, listas, código e citações saem iguais aos de um post — e nada
 * de HTML cru do modelo chega à página, porque o formatador o escapa.
 *
 * Durante o streaming o texto muda a cada pedaço; a renderização espera o
 * próximo quadro de animação, para dez pedaços num quadro custarem uma.
 * `streaming` põe o "●" piscando no fim do último parágrafo
 * (`.streamable-content.streaming`).
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

declare const s9e: { TextFormatter: { preview: (text: string, element: HTMLElement) => void } } | undefined;

export interface CookedAttrs extends ComponentAttrs {
  text: string;
  streaming?: boolean;
  className?: string;
}

export default class Cooked extends Component<CookedAttrs> {
  rendered: string | null = null;
  frame = 0;

  view() {
    return <div className={classList('Post-body CanelaAi-cooked', this.attrs.className, { 'is-streaming': this.attrs.streaming })} />;
  }

  oncreate(vnode: Mithril.VnodeDOM<CookedAttrs, this>) {
    super.oncreate(vnode);
    this.render();
  }

  onupdate(vnode: Mithril.VnodeDOM<CookedAttrs, this>) {
    super.onupdate(vnode);

    if (this.rendered === this.attrs.text || this.frame) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  onremove(vnode: Mithril.VnodeDOM<CookedAttrs, this>) {
    super.onremove(vnode);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  render() {
    const element = this.element as HTMLElement | undefined;

    if (!element) return;

    const text = this.attrs.text || '';
    this.rendered = text;

    if (typeof s9e !== 'undefined' && s9e?.TextFormatter) {
      s9e.TextFormatter.preview(text, element);
    } else {
      element.textContent = text;
    }

    // Links do texto da IA que apontam para fora abrem em outra aba; os do
    // próprio fórum seguem na mesma, como num post.
    element.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
      if (link.host && link.host !== window.location.host) {
        link.target = '_blank';
        link.rel = 'noopener nofollow ugc';
      }
    });
  }
}
