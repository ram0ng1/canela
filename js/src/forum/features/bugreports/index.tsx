/*
 * Relatar problema: um botão flutuante para quem tem a permissão. Ele abre um
 * menu com "Relatar um problema nesta página" (marca a área, descreve e envia)
 * e "Meus relatórios" (o status e a resposta da equipe).
 *
 * O servidor manda `canelaBugReports` só para quem pode reportar; para os
 * demais o recurso nem se instala. A seleção, a captura (html-to-image) e os
 * modais ficam num chunk à parte, baixado no primeiro clique.
 *
 * Baseado no Bugframe (github.com/vmatheus3/bug-frame), MIT.
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';

import { t } from '../../utils/settings';
import { installConsoleCapture, UI_ATTR } from './console';

export interface BugReportsOptions {
  button: boolean;
  console: boolean;
  full: boolean;
}

const STORAGE_KEY = 'canela.bugs';

export const options = (): BugReportsOptions | null => {
  const value = app.forum?.attribute<BugReportsOptions | null>('canelaBugReports');

  return value && typeof value === 'object' ? value : null;
};

const loadReporter = () => import('./reporter');

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const write = (on: boolean) => {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Armazenamento bloqueado: a escolha só não fica guardada.
  }
};

/** `?bugs=1` liga o botão neste navegador (até `?bugs=0`), quando o admin não o deixa sempre à vista. */
function shownByQuery(): boolean {
  const value = new URLSearchParams(window.location.search).get('bugs');

  if (value === '1' || value === '0') write(value === '1');

  return read();
}

class BugButton {
  open = false;

  view() {
    const opts = options();

    if (!opts || !app.session.user) return null;
    if (!opts.button && !shownByQuery()) return null;

    return (
      <div className={classList('CanelaBugButton', { open: this.open })}>
        {this.open && (
          <div className="CanelaBugButton-menu" role="menu">
            <button type="button" role="menuitem" className="CanelaBugButton-item" onclick={() => this.report()}>
              <Icon name="fas fa-crop-simple" />
              {t('bug_reports.menu_report')}
            </button>
            <button type="button" role="menuitem" className="CanelaBugButton-item" onclick={() => this.mine()}>
              <Icon name="fas fa-list-check" />
              {t('bug_reports.menu_mine')}
            </button>
            {!opts.button && (
              <button type="button" role="menuitem" className="CanelaBugButton-item" onclick={() => this.turnOff()}>
                <Icon name="fas fa-eye-slash" />
                {t('bug_reports.menu_off')}
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="CanelaBugButton-toggle"
          aria-haspopup="menu"
          aria-expanded={this.open ? 'true' : 'false'}
          aria-label={t('bug_reports.button')}
          title={t('bug_reports.button')}
          onclick={() => (this.open = !this.open)}
        >
          <Icon name={this.open ? 'fas fa-xmark' : 'fas fa-bug'} />
        </button>
      </div>
    );
  }

  report() {
    this.open = false;
    loadReporter().then((chunk) => chunk.startReport(options() as BugReportsOptions));
  }

  mine() {
    this.open = false;
    loadReporter().then((chunk) => chunk.showMyReports());
  }

  turnOff() {
    this.open = false;
    write(false);
  }
}

export default function installBugReports(): void {
  // No beforeMount o fórum e a sessão já existem.
  app.beforeMount(() => mountButton());
}

function mountButton(): void {
  // Sem a permissão (ou com o recurso desligado), nada a fazer.
  const opts = options();

  if (!opts) return;

  if (opts.console) installConsoleCapture();

  const root = document.createElement('div');

  root.setAttribute(UI_ATTR, '');
  root.className = 'CanelaBugRoot';
  document.body.appendChild(root);

  const button = new BugButton();

  m.mount(root, { view: () => button.view() });

  // Fecha o menu num clique fora dele.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (button.open && !(e.target as Element | null)?.closest?.('.CanelaBugButton')) {
        button.open = false;
        m.redraw();
      }
    },
    true
  );
}
