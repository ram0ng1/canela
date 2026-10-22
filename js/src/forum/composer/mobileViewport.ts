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
 * composer nela. No Android,
 * onde a janela já encolhe, os valores coincidem com os de sempre.
 *
 * Prender a caixa não basta: a altura da área de texto é o core quem grava,
 * em pixels, e ele só a recalcula ao redesenhar ou quando a janela muda de
 * tamanho — e o teclado do iOS não muda a janela. A área de texto ficava com
 * a altura da tela inteira e empurrava o rodapé para trás do teclado. Quando
 * a área visível muda, um redesenho faz o core medir a caixa já no tamanho
 * novo.
 */
import { extend } from 'flarum/common/extend';

import { isPhone } from '../motion/motionUtils';

const OPEN = '.Composer.CanelaComposer.visible:not(.minimized)';

/** Abaixo disso a diferença é a barra do navegador, não o teclado. */
const KEYBOARD_MIN = 120;

let frame = 0;
/** A última área aplicada: só um valor novo pede redesenho (sem laço). */
let applied = '';

function update(): void {
  frame = 0;

  const viewport = window.visualViewport;
  const root = document.documentElement;
  const open = !!viewport && isPhone() && !!document.querySelector(OPEN);

  if (!open) {
    root.style.removeProperty('--cn-vv-height');
    root.style.removeProperty('--cn-vv-top');
    root.classList.remove('CanelaComposerKeyboard');
    applied = '';

    return;
  }

  const height = Math.round(viewport!.height);
  const top = Math.round(viewport!.offsetTop);
  const keyboard = window.innerHeight - viewport!.height > KEYBOARD_MIN;
  const area = `${height}|${top}|${keyboard}`;

  root.style.setProperty('--cn-vv-height', `${height}px`);
  root.style.setProperty('--cn-vv-top', `${top}px`);
  root.classList.toggle('CanelaComposerKeyboard', keyboard);

  if (area !== applied) {
    applied = area;
    m.redraw();
  }
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
