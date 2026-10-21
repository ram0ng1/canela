/*
 * Utilidades de movimento compartilhadas pelos módulos de `motion/`.
 */

/** Quem pede menos movimento recebe tudo na hora (as durações vão a zero). */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Celular (< 768px): lá os menus são folhas e o toque não tem hover. */
export function isPhone(): boolean {
  return window.matchMedia?.('(max-width: 767.98px)').matches ?? false;
}
