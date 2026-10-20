/*
 * O composer do celular cabe na parte visível da tela, acima do teclado.
 *
 * No celular ele ocupa a tela toda (Composer.less). Só que, no iOS, abrir o
 * teclado não encolhe a janela do layout: o teclado passa POR CIMA da página,
 * e o rodapé do composer (a barra de formatação, "Descartar" e "Responder")
 * ficava escondido atrás dele. Pior: para mostrar o cursor, o Safari rola a
 * página inteira para cima, e o cabeçalho do composer sumia por cima.
 *
 * A área de fato visível é a `visualViewport` (altura e deslocamento): ela vai
 * para `--cn-vv-height` e `--cn-vv-top` no <html>, e o CSS do celular prende o
 * composer nela. É o mesmo que o Discourse faz (`--composer-vh`). No Android,
 * onde a janela já encolhe, os valores coincidem com os de sempre.
 */
import { extend } from 'flarum/common/extend';

import { isPhone } from '../motion/motionUtils';

const OPEN = '.Composer.CanelaComposer.visible:not(.minimized)';

/** Abaixo disso a diferença é a barra do navegador, não o teclado. */
const KEYBOARD_MIN = 120;

let frame = 0;

function update(): void {
  frame = 0;

  const viewport = window.visualViewport;
  const root = document.documentElement;
  const open = !!viewport && isPhone() && !!document.querySelector(OPEN);

  if (!open) {
    root.style.removeProperty('--cn-vv-height');
    root.style.removeProperty('--cn-vv-top');
    root.classList.remove('CanelaComposerKeyboard');

    return;
  }

  root.style.setProperty('--cn-vv-height', `${Math.round(viewport!.height)}px`);
  root.style.setProperty('--cn-vv-top', `${Math.round(viewport!.offsetTop)}px`);
  root.classList.toggle('CanelaComposerKeyboard', window.innerHeight - viewport!.height > KEYBOARD_MIN);
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(update);
}

export default function installMobileViewport(): void {
  const viewport = window.visualViewport;

  if (!viewport) return;

  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('orientationchange', schedule);

  // Abrir, minimizar e fechar o composer mudam se há o que prender.
  extend('flarum/forum/components/Composer' as any, ['oncreate', 'onupdate'] as any, schedule);
  extend('flarum/forum/components/Composer' as any, 'onremove', schedule);
}
