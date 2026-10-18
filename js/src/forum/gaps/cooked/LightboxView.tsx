/*
 * O lightbox em si (a camada, a galeria, o zoom e o teclado), num chunk: o
 * pacote principal só tem o ouvinte de clique (lightbox.tsx), e isto desce
 * quando o ponteiro passa por uma imagem de post (ou no primeiro clique).
 */
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import type { Slide } from './lightbox';

interface LightboxState {
  slides: Slide[];
  index: number;
  zoomed: boolean;
}

let state: LightboxState | null = null;
let root: HTMLElement | null = null;
let lastFocus: HTMLElement | null = null;
let touchStart: { x: number; y: number } | null = null;

function fileName(src: string): string {
  try {
    const path = new URL(src, window.location.href).pathname;

    return decodeURIComponent(path.split('/').pop() || 'imagem');
  } catch {
    return 'imagem';
  }
}

export function openLightbox(slides: Slide[], index = 0): void {
  if (!slides.length) return;

  ensureRoot();

  lastFocus = document.activeElement as HTMLElement | null;
  state = { slides, index, zoomed: false };
  document.documentElement.classList.add('CanelaLightbox-open');

  m.redraw();
}

export function closeLightbox(): void {
  if (!state) return;

  state = null;
  document.documentElement.classList.remove('CanelaLightbox-open');
  m.redraw();

  lastFocus?.focus?.();
}

function go(step: number): void {
  if (!state || state.slides.length < 2) return;

  const count = state.slides.length;

  // Como o PhotoSwipe, a galeria dá a volta: depois da última vem a primeira.
  state.index = (state.index + step + count) % count;
  state.zoomed = false;
  m.redraw();
}

function toggleZoom(): void {
  if (!state) return;

  state.zoomed = !state.zoomed;
  m.redraw();
}

function onKeydown(event: KeyboardEvent): void {
  if (!state) return;

  const handled: Record<string, () => void> = {
    Escape: closeLightbox,
    ArrowLeft: () => go(-1),
    ArrowRight: () => go(1),
    z: toggleZoom,
    Z: toggleZoom,
  };

  const action = handled[event.key];

  // Com o lightbox aberto, nenhuma outra tecla de atalho do fórum vale.
  event.stopImmediatePropagation();

  if (!action) return;

  event.preventDefault();
  action();
}

function ensureRoot(): void {
  if (root) return;

  root = document.createElement('div');
  root.className = 'CanelaLightboxRoot';
  document.body.appendChild(root);

  m.mount(root, { view: () => (state ? <Lightbox /> : null) });

  // Na captura: o lightbox fala antes dos atalhos do tema e do core.
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('popstate', () => closeLightbox());
}

class Lightbox extends Component {
  oncreate(vnode: Mithril.VnodeDOM) {
    super.oncreate(vnode);

    (this.element.querySelector('.CanelaLightbox-close') as HTMLElement | null)?.focus();
  }

  view() {
    if (!state) return null;

    const slide = state.slides[state.index];
    const many = state.slides.length > 1;

    return (
      <div
        className={classList('CanelaLightbox', { 'CanelaLightbox--zoomed': state.zoomed })}
        role="dialog"
        aria-modal="true"
        aria-label={slide.alt || t('gaps.lightbox.title')}
        ontouchstart={(event: TouchEvent) => {
          const touch = event.touches[0];
          touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        ontouchend={(event: TouchEvent) => {
          const touch = event.changedTouches[0];

          if (!touchStart || !touch || state?.zoomed) return;

          const dx = touch.clientX - touchStart.x;
          const dy = touch.clientY - touchStart.y;
          touchStart = null;

          // Deslizar para os lados troca a imagem; para baixo, fecha.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 80) closeLightbox();
        }}
      >
        <div className="CanelaLightbox-bg" onclick={closeLightbox} />

        <div className="CanelaLightbox-top">
          {many && (
            <div className="CanelaLightbox-counter" aria-live="polite">
              {t('gaps.lightbox.counter', { current: state.index + 1, total: state.slides.length })}
            </div>
          )}
          <div className="CanelaLightbox-buttons">
            {this.button('fas fa-magnifying-glass-plus', t('gaps.lightbox.zoom'), toggleZoom, 'zoom')}
            <a
              className="CanelaLightbox-button"
              href={slide.src}
              target="_blank"
              rel="noopener noreferrer"
              title={t('gaps.lightbox.open')}
              aria-label={t('gaps.lightbox.open')}
            >
              <Icon name="fas fa-up-right-from-square" />
            </a>
            <a
              className="CanelaLightbox-button"
              href={slide.src}
              download={fileName(slide.src)}
              title={t('gaps.lightbox.download')}
              aria-label={t('gaps.lightbox.download')}
            >
              <Icon name="fas fa-download" />
            </a>
            {this.button('fas fa-xmark', t('gaps.lightbox.close'), closeLightbox, 'close')}
          </div>
        </div>

        <div className="CanelaLightbox-stage" onclick={(event: MouseEvent) => event.target === event.currentTarget && closeLightbox()}>
          <img
            key={slide.src}
            className="CanelaLightbox-image"
            src={slide.src}
            alt={slide.alt}
            onclick={toggleZoom}
            onerror={(event: Event) => (event.target as HTMLElement).classList.add('CanelaLightbox-image--error')}
          />
        </div>

        {many && [
          <button
            type="button"
            className="CanelaLightbox-arrow CanelaLightbox-arrow--prev"
            aria-label={t('gaps.lightbox.previous')}
            title={t('gaps.lightbox.previous')}
            onclick={() => go(-1)}
          >
            <Icon name="fas fa-chevron-left" />
          </button>,
          <button
            type="button"
            className="CanelaLightbox-arrow CanelaLightbox-arrow--next"
            aria-label={t('gaps.lightbox.next')}
            title={t('gaps.lightbox.next')}
            onclick={() => go(1)}
          >
            <Icon name="fas fa-chevron-right" />
          </button>,
        ]}

        {slide.alt && <div className="CanelaLightbox-caption">{slide.alt}</div>}
      </div>
    );
  }

  button(icon: string, label: string, onclick: () => void, name: string): Mithril.Children {
    return (
      <button type="button" className={`CanelaLightbox-button CanelaLightbox-${name}`} title={label} aria-label={label} onclick={onclick}>
        <Icon name={icon} />
      </button>
    );
  }
}
