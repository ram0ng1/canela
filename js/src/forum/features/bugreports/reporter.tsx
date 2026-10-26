/*
 * O chunk do "Relatar problema", baixado no primeiro clique: a camada de
 * seleção (arrastar uma caixa sobre a tela), a captura e os dois modais.
 *
 * O fluxo segue o do Bugframe (github.com/vmatheus3/bug-frame, MIT): marcar a
 * área, descrever e enviar; o relatório chega com a captura e o contexto.
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';

import { t } from '../../utils/settings';
import { buildContext, UI_ATTR, type Rect } from './context';
import { captureArea, captureScreen, warm } from './capture';
import type { BugReportsOptions } from './index';

export { warm };

const MIN_SIDE = 12;

const normalize = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

/** A camada por cima da página. Resolve com a área, com null (tela inteira) ou com false (cancelou). */
function selectArea(): Promise<Rect | null | false> {
  return new Promise((resolve) => {
    const root = document.createElement('div');

    root.setAttribute(UI_ATTR, '');
    root.className = 'CanelaBugSelect';
    root.tabIndex = -1;
    document.body.appendChild(root);
    document.documentElement.classList.add('CanelaBugSelecting');

    let start: { x: number; y: number } | null = null;
    let rect: Rect | null = null;
    let hint = t('bug_reports.select_hint');

    const finish = (value: Rect | null | false) => {
      m.mount(root, null);
      root.remove();
      document.documentElement.classList.remove('CanelaBugSelecting');
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };

    document.addEventListener('keydown', onKey, true);

    m.mount(root, {
      view: () => [
        <div
          className="CanelaBugSelect-layer"
          onpointerdown={(e: PointerEvent) => {
            if (e.button > 0) return;
            e.preventDefault();

            try {
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            } catch {
              // Sem captura de ponteiro, o arraste ainda funciona dentro da camada.
            }

            start = { x: e.clientX, y: e.clientY };
            rect = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
          }}
          onpointermove={(e: PointerEvent) => {
            if (start) rect = normalize(start, { x: e.clientX, y: e.clientY });
          }}
          onpointerup={() => {
            if (!start) return;

            start = null;

            if (rect && rect.w >= MIN_SIDE && rect.h >= MIN_SIDE) {
              finish(rect);
            } else {
              rect = null;
              hint = t('bug_reports.select_too_small');
            }
          }}
        >
          {rect && rect.w > 0 && (
            <div className="CanelaBugSelect-rect" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }} />
          )}
        </div>,
        <div className="CanelaBugSelect-bar" onpointerdown={(e: PointerEvent) => e.stopPropagation()}>
          <span className="CanelaBugSelect-hint">
            <Icon name="fas fa-crop-simple" /> {hint}
          </span>
          <button type="button" className="Button Button--primary" onclick={() => finish(null)}>
            {t('bug_reports.whole_screen')}
          </button>
          <button type="button" className="Button" onclick={() => finish(false)}>
            {t('bug_reports.cancel')}
          </button>
        </div>,
      ],
    });

    root.focus();
  });
}

let busy = false;

/**
 * Roda `fn` depois de o modal aparecer e quando o navegador estiver livre: a
 * captura da tela inteira ocupa o navegador por um instante, e não pode
 * atrasar o modal.
 */
const afterModal = <T,>(fn: () => Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const run = () => fn().then(resolve, reject);

    setTimeout(() => {
      if ('requestIdleCallback' in window) (window as any).requestIdleCallback(run, { timeout: 1000 });
      else run();
    }, 700);
  });

/** Marcar, capturar e abrir o modal do envio. */
export async function startReport(opts: BugReportsOptions): Promise<void> {
  if (busy) return;

  app.modal.close();
  warm();

  const area = await selectArea();

  if (area === false) return;

  busy = true;

  // O aviso só aparece se a captura passar de um instante (a tela inteira).
  const toast = document.createElement('div');
  const showToast = setTimeout(() => document.body.appendChild(toast), 250);

  toast.setAttribute(UI_ATTR, '');
  toast.className = 'CanelaBugToast';
  toast.textContent = t('bug_reports.capturing');

  try {
    // Um quadro para a camada sair da tela antes da captura.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const context = buildContext(area, opts.console, String(app.current.get('routeName') || ''));
    const [region, { default: ReportModal }] = await Promise.all([area ? captureArea(area) : captureScreen(), import('./ReportModal')]);

    // A tela inteira (de referência) sai depois, enquanto a pessoa escreve.
    const full = opts.full && area ? afterModal(() => captureScreen(1)).catch(() => null) : Promise.resolve(null);

    app.modal.show(ReportModal, { region, full, context, onAnother: () => startReport(opts) });
  } catch {
    app.alerts.show({ type: 'error' }, t('bug_reports.capture_failed'));
  } finally {
    clearTimeout(showToast);
    toast.remove();
    busy = false;
  }
}

export function showMyReports(): void {
  app.modal.show(() => import('./MyReportsModal'));
}
