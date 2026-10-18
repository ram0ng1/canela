/*
 * O retorno das ações do post (`lib/post-action-feedback` do Discourse):
 * depois de copiar o link, um "certo" verde se desenha no canto do botão
 * (`draw`, 1s) e "Link copiado!" aparece em cima dele; os dois esmaecem
 * (0,25s) e somem em 2,5s.
 *
 * O botão de link do tópico avisa que copiou pela classe
 * `CanelaPostAction--copied`; o clique só arma a espera por ela.
 */
import { t } from '../utils/settings';

const TIMEOUT = 2500;
const TRANSITION_BUFFER = 250;
const WAIT_MS = 1500;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Mostra o retorno num botão. Exportada para outros botões que copiam. */
export function postActionFeedback(button: HTMLElement, message: string) {
  // Já está mostrando (clique duplo): não empilha.
  if (button.querySelector('.CanelaFeedback-check')) return;

  const alert = document.createElement('div');
  alert.className = 'CanelaFeedback-alert';
  alert.setAttribute('role', 'status');
  alert.textContent = message;

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'CanelaFeedback-check');
  svg.setAttribute('viewBox', '0 0 52 52');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('d', 'M13 26 l10 10 20 -20');
  svg.appendChild(path);

  button.classList.add('CanelaFeedback');
  button.append(alert, svg);

  // No quadro seguinte, para a transição de opacidade acontecer.
  requestAnimationFrame(() => button.classList.add('CanelaFeedback--activated', 'CanelaFeedback--transition'));

  window.setTimeout(() => button.classList.remove('CanelaFeedback--activated'), TIMEOUT - TRANSITION_BUFFER);
  window.setTimeout(() => {
    alert.remove();
    svg.remove();
    button.classList.remove('CanelaFeedback--transition');
  }, TIMEOUT);
}

function waitForCopied(button: HTMLElement) {
  const started = performance.now();

  const check = () => {
    if (!button.isConnected) return;

    if (button.classList.contains('CanelaPostAction--copied')) {
      postActionFeedback(button, t('motion.link_copied'));
    } else if (performance.now() - started < WAIT_MS) {
      requestAnimationFrame(check);
    }
  };

  requestAnimationFrame(check);
}

export default function installFeedback() {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.('.CanelaPostAction--share');

    if (button instanceof HTMLElement) waitForCopied(button);
  });
}
