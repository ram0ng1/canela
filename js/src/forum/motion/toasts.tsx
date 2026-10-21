/*
 * Os alertas que aparecem e somem (o AlertManager do core) viram toasts
 * (`.fk-d-toast`): o ícone do tema à esquerda
 * (certo, triângulo, exclamação, "i"), o texto e o ✕; fecham sozinhos depois
 * de 3s ("short") — ou 5s ("long") — esmaecendo, param de contar com o mouse
 * em cima e, no celular, saem com um peteleco para cima.
 *
 * Os alertas da página (o `.Alert` dentro do conteúdo) não mudam: só os do
 * AlertManager ganham a classe `CanelaToast`.
 */
import { extend } from 'flarum/common/extend';
import Alert from 'flarum/common/components/Alert';
import AlertManager from 'flarum/common/components/AlertManager';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import { prefersReducedMotion } from './motionUtils';

// `DToast.duration` e o `auto-close-toast` do float-kit.
const SHORT_MS = 3000;
const LONG_MS = 5000;
const CSS_TRANSITION_DELAY_MS = 300;
const FADE_OUT_CLASS = 'CanelaToast--fadeOut';
// `DToast`: velocidade (px/ms) do peteleco que fecha; e o recuo ao fechar.
const VELOCITY_THRESHOLD = -1.2;
const SWIPE_DISTANCE = 50;
const MAX_ANIMATION_MS = 200;

const TOAST_CLASS = 'CanelaToast';

/** O ícone de cada tema, como em `toasts.success/error/warning/info`. */
const THEME_ICONS: Record<string, string> = {
  success: 'fas fa-check',
  error: 'fas fa-exclamation-triangle',
  warning: 'fas fa-exclamation-circle',
  info: 'fas fa-info-circle',
};

interface ToastTimer {
  element: HTMLElement;
  duration: number;
  close: () => void;
  fadeTimer?: number;
  closeTimer?: number;
  stopped?: boolean;
}

const timers = new WeakMap<HTMLElement, ToastTimer>();

function startTimer(timer: ToastTimer) {
  if (timer.stopped) return;

  stopTimer(timer);
  timer.fadeTimer = window.setTimeout(() => {
    timer.element.classList.add(FADE_OUT_CLASS);
    timer.closeTimer = window.setTimeout(timer.close, CSS_TRANSITION_DELAY_MS);
  }, timer.duration);
}

function stopTimer(timer: ToastTimer) {
  window.clearTimeout(timer.fadeTimer);
  window.clearTimeout(timer.closeTimer);
  // Quem volta a olhar o toast enquanto ele some o traz de volta.
  timer.element.classList.remove(FADE_OUT_CLASS);
}

function flatten(children: unknown): Mithril.Vnode<any, any>[] {
  if (!Array.isArray(children)) return [];

  return children.flatMap((child: any) => (child && child.tag === '[' ? flatten(child.children) : child ? [child] : []));
}

/** Peteleco para cima no celular (`dSwipe` do toast). */
function bindSwipe(element: HTMLElement, close: () => void) {
  let startY = 0;
  let startT = 0;
  let deltaY = 0;
  let tracking = false;

  const animateTo = (y: number, done?: () => void) => {
    const animation = element.animate([{ transform: `translateY(${y}px)` }], {
      duration: prefersReducedMotion() ? 0 : MAX_ANIMATION_MS,
      fill: 'forwards',
    });

    animation.onfinish = () => done?.();
  };

  element.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      tracking = true;
      startY = event.touches[0].clientY;
      startT = performance.now();
      deltaY = 0;
    },
    { passive: true }
  );

  element.addEventListener(
    'touchmove',
    (event) => {
      if (!tracking) return;
      deltaY = event.touches[0].clientY - startY;
      // Só para cima: para baixo o toast não sai do lugar.
      element.style.transform = `translateY(${Math.min(0, deltaY)}px)`;
    },
    { passive: true }
  );

  element.addEventListener('touchend', () => {
    if (!tracking) return;
    tracking = false;

    const velocity = deltaY / Math.max(1, performance.now() - startT);
    element.style.transform = '';

    if (deltaY < 0 && (velocity < VELOCITY_THRESHOLD || deltaY < -SWIPE_DISTANCE)) {
      element.style.transform = `translateY(${deltaY}px)`;
      animateTo(-150, close);
    } else if (deltaY < 0) {
      element.style.transform = `translateY(${deltaY}px)`;
      animateTo(0, () => {
        element.style.transform = '';
        element.getAnimations().forEach((animation) => animation.cancel());
      });
    }
  });
}

/**
 * Os toasts formam uma coluna só no alto à direita
 * (`.fk-d-toasts`), mas há duas pilhas — o AlertManager do core e as
 * notificações do flarum/realtime —, então a segunda começa onde a primeira
 * termina: a altura dos alertas vai para `--cn-toasts-offset`.
 */
function watchAlertsHeight(): void {
  const update = (element: Element | null) => {
    const height = element ? Math.ceil(element.getBoundingClientRect().height) : 0;

    document.documentElement.style.setProperty('--cn-toasts-offset', height > 0 ? `${height + 5}px` : '0px');
  };

  const attach = () => {
    const manager = document.querySelector('.AlertManager');

    if (!manager || typeof ResizeObserver === 'undefined') return false;

    new ResizeObserver(() => update(manager)).observe(manager);
    update(manager);

    return true;
  };

  if (!attach()) window.setTimeout(attach, 1000);
}

export default function installToasts() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchAlertsHeight);
  else window.setTimeout(watchAlertsHeight, 0);

  // Marca os alertas do AlertManager e dá uma chave a cada um. Sem chave, ao
  // fechar o primeiro o Mithril reaproveitaria o componente dele para o
  // segundo — e o cronômetro de um fecharia o outro.
  extend(AlertManager.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    const ids = Object.keys(this.state.getActiveAlerts());
    const wrappers = flatten(vdom.children);

    if (wrappers.length !== ids.length) return;

    wrappers.forEach((wrapper, index) => {
      wrapper.key = ids[index];

      const alert = flatten(wrapper.children)[0];

      if (alert && alert.attrs) {
        alert.attrs.className = classList(alert.attrs.className, TOAST_CLASS);
      }
    });
  });

  // O ícone do tema antes do texto, como o `__icon-container`.
  extend(Alert.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    if (!vdom?.attrs || !String(vdom.attrs.className || '').includes(TOAST_CLASS)) return;

    const icon = this.attrs.icon && this.attrs.title ? null : THEME_ICONS[this.attrs.type as string];
    const containerVnode = flatten(vdom.children)[0];

    if (!icon || !containerVnode || !Array.isArray(containerVnode.children)) return;

    containerVnode.children.unshift(
      <div className="CanelaToast-icon" aria-hidden="true">
        <Icon name={icon} />
      </div>
    );
  });

  extend(Alert.prototype, 'oncreate', function (this: any) {
    const element = this.element as HTMLElement;

    if (!element?.classList.contains(TOAST_CLASS)) return;

    const close = () => (this.attrs.ondismiss as (() => void) | undefined)?.();

    bindSwipe(element, close);

    // Os que não se fecham (o "carregando" de quem ainda o usa) ficam.
    // Lida aqui, e não no install: no initializer o `app.forum` não existe.
    if (!forumBool('canelaToastAutoClose', true) || this.attrs.dismissible === false) return;

    const hasControls = Array.isArray(this.attrs.controls) && this.attrs.controls.length > 0;
    const timer: ToastTimer = {
      element,
      // Erros e avisos com botões ficam mais ("long"): dão o que ler e o que clicar.
      duration: this.attrs.type === 'error' || hasControls ? LONG_MS : SHORT_MS,
      close,
    };

    timers.set(element, timer);

    element.addEventListener('mouseenter', () => stopTimer(timer), { passive: true });
    element.addEventListener('mouseleave', () => startTimer(timer), { passive: true });
    // No toque não há "sair de cima": tocou, o toast fica até o ✕.
    element.addEventListener(
      'touchstart',
      () => {
        stopTimer(timer);
        timer.stopped = true;
      },
      { passive: true, once: true }
    );
    // Quem chega pelo teclado também ganha tempo.
    element.addEventListener('focusin', () => stopTimer(timer));
    element.addEventListener('focusout', () => startTimer(timer));

    startTimer(timer);
  });

  extend(Alert.prototype, 'onremove', function (this: any) {
    const timer = this.element && timers.get(this.element);

    if (timer) {
      timer.stopped = true;
      window.clearTimeout(timer.fadeTimer);
      window.clearTimeout(timer.closeTimer);
      timers.delete(this.element);
    }
  });
}
