/*
 * O fechamento dos menus (`.fk-d-menu.-animated.-closing` do Discourse): o
 * menu sobe esmaecendo em 125ms (`dissolve-up`), ou desce quando abria para
 * cima (`dissolve-down`). A abertura (`float-down`, 250ms) é só CSS.
 *
 * O dropdown do Bootstrap tira a classe `open` de uma vez, então não dá para
 * animar o próprio menu. No `hide.bs.dropdown` (que vem antes de fechar) o
 * menu é copiado para um "fantasma" fixo no mesmo lugar, que faz a animação
 * e se desfaz — o estado do dropdown não é tocado.
 */
import { isPhone, prefersReducedMotion } from './motionUtils';

const GHOST_CLASS = 'CanelaMenuGhost';
const CLOSING_MS = 125;

function ghostMenu(dropdown: HTMLElement) {
  if (!dropdown.classList.contains('open')) return;

  // Os painéis do cabeçalho (notificações, usuário, idioma) são os
  // `.menu-panel` do Discourse, que fecham na hora.
  if (dropdown.closest('.App-header, .App-navigation, .CanelaSidebar')) return;

  const menu = dropdown.querySelector<HTMLElement>(':scope > .Dropdown-menu');

  if (!menu || menu.classList.contains('Dropdown-menu--inline')) return;

  const rect = menu.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  const clone = menu.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  clone.style.cssText += `;position:absolute;top:0;left:0;right:auto;bottom:auto;margin:0;width:${rect.width}px;height:${rect.height}px;max-height:none;`;

  // O fantasma leva as classes do dropdown: as regras como
  // `.Dropdown.open > .Dropdown-menu` e as do próprio componente valem nele.
  const ghost = document.createElement('div');
  ghost.className = `${dropdown.className} ${GHOST_CLASS}`;
  ghost.classList.add('open');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;margin:0;`;
  ghost.appendChild(clone);
  document.body.appendChild(ghost);

  const remove = () => ghost.remove();
  clone.addEventListener('animationend', remove, { once: true });
  // Se a animação não rodar (aba em segundo plano), some do mesmo jeito.
  window.setTimeout(remove, CLOSING_MS + 150);
}

export default function installMenus() {
  const $ = (window as any).$;

  if (!$) return;

  $(document).on('hide.bs.dropdown', (event: { target: EventTarget | null }) => {
    if (prefersReducedMotion() || isPhone()) return;

    const dropdown = event.target as HTMLElement | null;

    if (!dropdown || !(dropdown instanceof HTMLElement)) return;

    try {
      ghostMenu(dropdown);
    } catch {
      // O fantasma é só enfeite: se falhar, o menu fecha como no core.
    }
  });
}
