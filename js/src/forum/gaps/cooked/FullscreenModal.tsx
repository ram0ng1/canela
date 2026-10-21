/*
 * "Exibir código em tela cheia" e "Expandir tabela": a mesma
 * janela grande, com uma cópia do bloco do post.
 *
 * O HTML vem do próprio post já desenhado (o servidor já o limpou), então
 * pode entrar com m.trust sem passar de novo pelo formatador.
 */
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';

export interface CookedFullscreenModalAttrs extends IInternalModalAttrs {
  title: string;
  html: string;
  kind: 'code' | 'table';
}

export default class CookedFullscreenModal extends Modal<CookedFullscreenModalAttrs> {
  className() {
    return `CanelaFullscreenModal CanelaFullscreenModal--${this.attrs.kind} Modal--large`;
  }

  title() {
    return this.attrs.title;
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <div className="CanelaFullscreenModal-content Post-body">{m.trust(this.attrs.html)}</div>
      </div>
    );
  }
}
