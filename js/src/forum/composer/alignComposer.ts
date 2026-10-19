/*
 * O composer (sem a prévia) fica alinhado ao cartão do conteúdo. O CSS fazia a
 * conta com --cn-main-max, o que só funciona em px: com a largura do conteúdo
 * em porcentagem (90%, largura toda) a conta saía errada e o composer ia para
 * cima da barra lateral. Aqui a posição real do cartão vira variáveis CSS.
 */
import app from 'flarum/forum/app';

let frame = 0;

function measure(): void {
  frame = 0;

  const card = document.querySelector<HTMLElement>('#content .Page-container.container, #content .container');
  const root = document.documentElement;

  if (!card || window.innerWidth < 768) {
    root.style.removeProperty('--cn-composer-card-left');
    root.style.removeProperty('--cn-composer-card-room');
    return;
  }

  const rect = card.getBoundingClientRect();

  root.style.setProperty('--cn-composer-card-left', `${Math.round(rect.left)}px`);
  root.style.setProperty('--cn-composer-card-room', `${Math.round(rect.width)}px`);
}

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

      if (typeof ResizeObserver !== 'undefined' && area) new ResizeObserver(schedule).observe(area);
      if (content) new MutationObserver(schedule).observe(content, { childList: true });

      schedule();
    });
  });
}
