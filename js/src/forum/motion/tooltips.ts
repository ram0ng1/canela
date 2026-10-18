/*
 * Dicas dos botões só de ícone. No Discourse todo botão de ícone tem um
 * `title` (os controles do post, os ícones do cabeçalho, o ✕ dos modais), e
 * o navegador mostra a dica ao parar o mouse. No Flarum esses botões só têm
 * `aria-label`; quando não estão dentro de um `<Tooltip>` do core, o rótulo
 * vira também o `title`.
 */
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';

const pending = new Set<HTMLElement>();
let scheduled = false;

function sync(element: HTMLElement) {
  if (!element.isConnected) return;

  // O <Tooltip> do core já mostra a dica (e guarda o texto no jQuery).
  const $ = (window as any).$;
  if ($ && $(element).data('bs.tooltip')) return;

  const own = element.dataset.canelaTitle;
  const current = element.getAttribute('title');

  // Um título próprio do componente manda.
  if (current && current !== own) return;

  const label = element.getAttribute('aria-label')?.trim();
  const iconOnly = !element.textContent?.trim();

  if (label && iconOnly) {
    if (current !== label) element.setAttribute('title', label);
    element.dataset.canelaTitle = label;
  } else if (own) {
    element.removeAttribute('title');
    delete element.dataset.canelaTitle;
  }
}

function flush() {
  scheduled = false;
  pending.forEach(sync);
  pending.clear();
}

export default function installTooltips() {
  // Espera o quadro: o <Tooltip> em volta do botão monta depois dele.
  extend(Button.prototype, ['oncreate', 'onupdate'] as any, function (this: any) {
    const element = this.element as HTMLElement | undefined;

    if (!element) return;

    pending.add(element);

    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  });
}
