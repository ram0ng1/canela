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
import { captureViewport, cropImage, maskImage, maskRects, toJpeg } from './capture';
import type { BugReportsOptions } from './index';

const MIN_SIDE = 12;
/** Acima disso (em caracteres do data URL) a área vai em JPEG, para caber no envio. */
const MAX_PNG = 3_500_000;

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

/** Marcar, capturar e abrir o modal do envio. */
export async function startReport(opts: BugReportsOptions): Promise<void> {
  if (busy) return;

  app.modal.close();

  const area = await selectArea();

  if (area === false) return;

  busy = true;

  const toast = document.createElement('div');

  toast.setAttribute(UI_ATTR, '');
  toast.className = 'CanelaBugToast';
  toast.textContent = t('bug_reports.capturing');
  document.body.appendChild(toast);

  try {
    // Um quadro para a camada sair da tela antes da captura.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const raw = await captureViewport();
    const masked = await maskImage(raw, maskRects(), viewport);

    let region = area ? await cropImage(masked, area, viewport) : await toJpeg(masked);

    if (region.length > MAX_PNG) region = await toJpeg(region);

    const full = opts.full && area ? await toJpeg(masked) : null;
    const context = buildContext(area, opts.console, String(app.current.get('routeName') || ''));

    const { default: ReportModal } = await import('./ReportModal');

    app.modal.show(ReportModal, { region, full, context, onAnother: () => startReport(opts) });
  } catch {
    app.alerts.show({ type: 'error' }, t('bug_reports.capture_failed'));
  } finally {
    toast.remove();
    busy = false;
  }
}

export function showMyReports(): void {
  app.modal.show(() => import('./MyReportsModal'));
}
