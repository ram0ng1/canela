/*
 * As trocas de forma do composer (Markdown ↔ "A", mostrar/esconder a prévia,
 * entrar e sair da tela cheia) animadas como um movimento só.
 *
 * Antes, o CSS animava só `max-width` e `margin`: `margin: auto` não se anima,
 * então o composer pulava de lado e depois crescia ou encolhia; na tela cheia
 * a altura e o topo mudavam de uma vez e a largura vinha depois. Aqui a troca
 * é aplicada de uma vez, a caixa nova é medida e o composer vai da caixa
 * antiga até a nova (esquerda, topo, largura e altura juntos), preso à tela
 * durante o movimento, e o conteúdo reaparece no fim. Depois, as regras de
 * sempre voltam a valer.
 */
import app from 'flarum/forum/app';

const DURATION = 240;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

let running: Animation[] = [];

function composerElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.Composer.CanelaComposer');
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function stopRunning(): void {
  running.forEach((animation) => animation.cancel());
  running = [];
}

function restore(el: HTMLElement): void {
  el.style.removeProperty('position');
  el.style.removeProperty('overflow');
}

/** Aplica `change` (que redesenha) e anima o composer da caixa antiga até a nova. */
export function morphComposer(change: () => void): void {
  const before = composerElement();

  if (!before || app.screen() === 'phone' || reducedMotion() || typeof before.animate !== 'function') {
    change();
    return;
  }

  stopRunning();
  restore(before);

  const from = before.getBoundingClientRect();

  // Sem as transições do CSS na troca: elas segurariam a largura antiga na
  // hora de medir a caixa nova (e brigariam com este movimento).
  before.style.transition = 'none';
  const wasFull = before.classList.contains('fullScreen');

  change();
  // Dois redesenhos: no primeiro o Composer do core só registra a posição
  // nova; a altura dele (e a da área de texto) é ajustada no seguinte.
  m.redraw.sync();
  m.redraw.sync();

  const el = composerElement();

  if (!el) {
    before.style.removeProperty('transition');
    return;
  }

  const to = el.getBoundingClientRect();

  el.style.removeProperty('transition');

  if (
    Math.abs(from.left - to.left) < 1 &&
    Math.abs(from.top - to.top) < 1 &&
    Math.abs(from.width - to.width) < 1 &&
    Math.abs(from.height - to.height) < 1
  ) {
    return;
  }

  // Presa à tela durante o movimento (fora dele, o composer normal é
  // `relative` dentro da faixa do pé da página, e o de tela cheia é `fixed`).
  el.style.position = 'fixed';
  el.style.overflow = 'hidden';

  const box = (rect: DOMRect): Keyframe => ({
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxWidth: 'none',
    margin: '0px',
  });

  const options: KeyframeAnimationOptions = { duration: DURATION, easing: EASING };
  const main = el.animate([box(from), box(to)], options);

  running = [main];

  // O conteúdo já está no lugar novo: some por um instante e reaparece com a
  // caixa quase pronta, em vez de mostrar o texto se reorganizando enquanto
  // a largura muda.
  const content = el.querySelector<HTMLElement>('.Composer-content');

  if (content) {
    running.push(
      content.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: DURATION * 0.75, delay: DURATION * 0.45, easing: 'ease-out', fill: 'backwards' }
      )
    );
  }

  // A folha branca da tela cheia sem a prévia (o `::before`) acompanha.
  if (!wasFull && el.classList.contains('fullScreen')) {
    try {
      running.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: 'ease-out', pseudoElement: '::before' }));
    } catch {
      // Navegador sem animação de pseudo-elemento: a folha só aparece.
    }
  }

  main.onfinish = main.oncancel = () => {
    if (running.includes(main)) running = [];
    restore(el);
  };

  // Enquanto a caixa anima, o core mede o composer (a cada redesenho, como o
  // do foco que ele faz ao sair da tela cheia) e grava na área de texto uma
  // altura tirada da caixa ainda em movimento: o rodapé (a barra e
  // "Publicar") ia para fora da janela, ou para o meio da tela cheia. Quando
  // tudo para, um redesenho faz o core medir de novo, com a caixa no lugar.
  // Interrompido por outra troca, quem mede é a troca seguinte.
  Promise.all(running.map((animation) => animation.finished)).then(
    () => m.redraw.sync(),
    () => {}
  );
}
