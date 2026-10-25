/*
 * O composer (sem a prévia) fica alinhado ao cartão do conteúdo. O CSS fazia a
 * conta com --cn-main-max, o que só funciona em px: com a largura do conteúdo
 * em porcentagem (90%, largura toda) a conta saía errada e o composer ia para
 * cima da barra lateral. Aqui a posição real do cartão vira variáveis CSS.
 */
import app from 'flarum/forum/app';

let frame = 0;

/**
 * Enquanto a página carrega (o indicador no lugar do conteúdo) não há cartão:
 * um cartão invisível, de altura zero, com as mesmas classes, dá a posição
 * que o de verdade vai ter. Sem isso o composer aberto pulava para o canto
 * da área de conteúdo e voltava quando a página chegava.
 */
function ghostRect(): DOMRect | null {
  // Na área de conteúdo, e não no #content: lá o MutationObserver abaixo veria
  // o fantasma entrar e sair e mediria de novo, sem parar.
  const area = document.querySelector<HTMLElement>('.App-content');

  if (!area) return null;

  const ghost = document.createElement('div');
  ghost.className = 'Page-container container';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = 'height:0;min-height:0;padding-top:0;padding-bottom:0;border:0;visibility:hidden;overflow:hidden';
  area.appendChild(ghost);

  const rect = ghost.getBoundingClientRect();
  ghost.remove();

  return rect.width > 0 ? rect : null;
}

function measure(): void {
  frame = 0;

  const card = document.querySelector<HTMLElement>('#content .Page-container.container, #content .container');
  const root = document.documentElement;

  if (window.innerWidth < 768) {
    root.style.removeProperty('--cn-composer-card-left');
    root.style.removeProperty('--cn-composer-card-room');
    lastLeft = lastRoom = '';
    return;
  }

  const rect = card ? card.getBoundingClientRect() : ghostRect();

  // Sem cartão nem fantasma (uma página sem `.container`): fica a última medida.
  if (!rect) return;

  const left = `${Math.round(rect.left)}px`;
  const room = `${Math.round(rect.width)}px`;

  // Uma variável no <html> recalcula o estilo da página toda: só quando muda.
  if (left === lastLeft && room === lastRoom) return;

  lastLeft = left;
  lastRoom = room;
  root.style.setProperty('--cn-composer-card-left', left);
  root.style.setProperty('--cn-composer-card-room', room);
}

let lastLeft = '';
let lastRoom = '';
let lastAreaWidth = -1;

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(measure);
}

export default function installAlignComposer(): void {
  window.addEventListener('resize', schedule, { passive: true });

  // O cartão muda de lugar quando a barra lateral abre/fecha (a área de
  // conteúdo muda de largura) e é recriado a cada troca de página.
  app.beforeMount(() => {
    requestAnimationFrame(() => {
      const content = document.getElementById('content');
      const area = document.querySelector('.App-content');

      // Só a largura importa: a altura muda com o padding que o core põe no
      // #content a cada movimento da alça do editor, e medir ali forçava o
      // layout a cada quadro do arrasto.
      if (typeof ResizeObserver !== 'undefined' && area) {
        new ResizeObserver((entries) => {
          const width = entries[entries.length - 1]?.contentRect.width ?? -1;

          if (width === lastAreaWidth) return;

          lastAreaWidth = width;
          schedule();
        }).observe(area);
      }
      if (content) new MutationObserver(schedule).observe(content, { childList: true });

      schedule();
    });
  });
}
