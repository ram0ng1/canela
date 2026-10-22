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
 *
 * O rodapé (a barra, Descartar e Publicar) fica colado na borda de baixo o
 * movimento inteiro: a área de texto anima a altura junto com a caixa, e o
 * core não a remede enquanto a caixa está no meio do caminho (ver
 * `isMorphing`).
 */
import app from 'flarum/forum/app';

const DURATION = 240;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

let running: Animation[] = [];
let morphing = false;

/**
 * Se o composer está no meio de uma troca. O `updateHeight()` do core mede a
 * caixa a cada redesenho e grava a altura na área de texto: no meio do
 * movimento, ela sai da caixa antiga, e o rodapé ia para o meio da tela
 * (entrando na tela cheia) ou para fora da janela (saindo) até o fim.
 */
export function isMorphing(): boolean {
  return morphing;
}

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
  morphing = false;
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
  morphing = true;

  // A área de texto cresce (ou encolhe) o mesmo que a caixa, no mesmo ritmo:
  // o rodapé, logo abaixo dela, acompanha a borda de baixo.
  const grow = to.height - from.height;

  if (Math.abs(grow) >= 1) {
    el.querySelectorAll<HTMLElement>('.Composer-flexible').forEach((flexible) => {
      const height = flexible.getBoundingClientRect().height;

      running.push(flexible.animate([{ height: `${Math.max(0, height - grow)}px` }, { height: `${height}px` }], { ...options, fill: 'backwards' }));
    });
  }

  // O conteúdo já está no lugar novo: some por um instante e reaparece com a
  // caixa quase pronta, em vez de mostrar o texto se reorganizando enquanto
  // a largura muda. O rodapé fica de fora: parado e visível o tempo todo.
  el.querySelectorAll<HTMLElement>('.ComposerBody-header, .TextEditor-editorContainer, .CanelaComposerPreview').forEach((part) => {
    running.push(
      part.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION * 0.75, delay: DURATION * 0.45, easing: 'ease-out', fill: 'backwards' })
    );
  });

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

  // Quando tudo para, o core volta a medir (um redesenho, com a caixa no
  // lugar). Interrompido por outra troca, quem mede é a troca seguinte.
  Promise.all(running.map((animation) => animation.finished)).then(
    () => {
      morphing = false;
      m.redraw.sync();
    },
    () => {}
  );
}
