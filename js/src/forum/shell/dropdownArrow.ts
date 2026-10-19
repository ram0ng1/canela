/*
 * A seta dos menus que abrem de um botão só com ícone (o sino de acompanhar,
 * o ⋮ do tópico e das postagens…): um bico na borda do menu apontando para o
 * botão, para ficar claro de onde ele saiu.
 *
 * O Dropdown do core dispara `shown.bs.dropdown` depois de decidir se o menu
 * abre para cima (`--top`) e de que lado (`--right`); este ouvinte, no
 * documento, roda depois dele e mede o menu já no lugar. A seta é um elemento
 * à parte dentro do `.Dropdown` (e não um ::before do menu): um menu com
 * rolagem cortaria o que passa da borda dele. Ela copia o fundo e a borda do
 * próprio menu, então acompanha qualquer tema e o modo escuro.
 *
 * No celular os menus são folhas que sobem do pé da tela (posição fixa): ali
 * não há de onde apontar, e nada muda.
 */

const ARROW_CLASS = 'CanelaDropdownArrow';
const OPEN_CLASS = 'CanelaDropdown--arrow';
/** A seta: uma janela de WIDTH × HEIGHT que mostra só a metade de fora de um quadrado girado. */
const WIDTH = 26;
const HEIGHT = 13;
/** Distância mínima da seta até o canto arredondado do menu. */
const EDGE = 14;
/** O vão entre o botão e o menu com a seta (o mesmo da margem no LESS). */
const GAP = 10;

/** O botão é só um ícone (sem texto visível)? */
function iconOnly(toggle: HTMLElement): boolean {
  if (toggle.classList.contains('Button--icon')) return true;

  const label = toggle.querySelector('.Button-label');

  return !!toggle.querySelector('.Button-icon, .icon') && !(label?.textContent || '').trim();
}

function removeArrow(dropdown: HTMLElement): void {
  dropdown.querySelector(`:scope > .${ARROW_CLASS}`)?.remove();
  const menu = dropdown.querySelector<HTMLElement>(':scope > .Dropdown-menu');

  menu?.classList.remove(OPEN_CLASS, 'is-up');

  // Desfaz a aproximação (abaixo): na próxima vez o core posiciona de novo.
  if (menu?.dataset.canelaArrowMoved) {
    menu.style.top = '';
    menu.style.bottom = '';
    delete menu.dataset.canelaArrowMoved;
  }
}

function placeArrow(dropdown: HTMLElement): void {
  removeArrow(dropdown);

  const toggle = dropdown.querySelector<HTMLElement>(':scope > .Dropdown-toggle');
  const menu = dropdown.querySelector<HTMLElement>(':scope > .Dropdown-menu');

  if (!toggle || !menu || !iconOnly(toggle)) return;

  const menuStyle = getComputedStyle(menu);

  // Folha do celular (fixa no pé da tela) ou menu escondido: sem seta.
  if (menuStyle.position === 'fixed' || menuStyle.display === 'none') return;

  menu.classList.add(OPEN_CLASS);

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  // O bico com o fundo do próprio menu e, se ele tiver, a cor da borda; sem
  // borda, o contorno fino do LESS o desenha sobre um fundo da mesma cor.
  arrow.style.setProperty('--cn-arrow-bg', menuStyle.backgroundColor);

  if (parseFloat(menuStyle.borderTopWidth) > 0) arrow.style.setProperty('--cn-arrow-edge', menuStyle.borderTopColor);

  const z = parseInt(menuStyle.zIndex, 10);
  if (!Number.isNaN(z)) arrow.style.zIndex = String(z + 1);

  dropdown.appendChild(arrow);

  // Tudo pela posição de layout (offsetTop/offsetLeft), e não pelo retângulo
  // na tela: o menu entra com uma animação que o desloca enquanto aparece.
  const parent = (arrow.offsetParent as HTMLElement | null) ?? document.body;
  const box = layoutBox(menu, parent);
  const toggleBox = toggle.getBoundingClientRect();
  const parentBox = parent.getBoundingClientRect();
  const toggleTop = toggleBox.top - parentBox.top - parent.clientTop + parent.scrollTop;
  const up = box.top + box.height <= toggleTop + 1;

  menu.classList.toggle('is-up', up);
  arrow.className = ARROW_CLASS + (up ? ' is-up' : '');

  // Menu longe do botão: o `.Dropdown` é mais alto que ele (o ⋮ das linhas da
  // lista fica no meio de uma caixa da altura da linha, e o menu abria embaixo
  // dela, a uns 50px). Aproxima o menu do botão, para a seta apontar para ele.
  const toggleBottom = toggleTop + toggleBox.height;
  const placed = layoutBox(menu, parent);
  const gap = up ? toggleTop - (placed.top + placed.height) : placed.top - toggleBottom;

  if (gap > GAP + 2) {
    const shift = gap - GAP;
    const current = getComputedStyle(menu);

    if (up) menu.style.bottom = `${parseFloat(current.bottom) - shift}px`;
    else menu.style.top = `${parseFloat(current.top) - shift}px`;

    menu.dataset.canelaArrowMoved = '1';
  }

  // A classe `is-up` troca a margem do menu: mede de novo.
  const final = layoutBox(menu, parent);
  const center = toggleBox.left + toggleBox.width / 2 - parentBox.left - parent.clientLeft + parent.scrollLeft;
  // Dentro do menu, longe dos cantos arredondados.
  const x = Math.min(Math.max(center, final.left + EDGE), final.left + final.width - EDGE);
  const y = up ? final.top + final.height : final.top;

  // A janela encosta na borda do menu (1px por cima dela, para não sobrar fresta).
  arrow.style.left = `${x - WIDTH / 2}px`;
  arrow.style.top = `${up ? y - 1 : y - HEIGHT + 1}px`;
}

/** A caixa do elemento em relação a `parent`, sem os transforms (animações). */
function layoutBox(element: HTMLElement, parent: HTMLElement): { left: number; top: number; width: number; height: number } {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;

  while (node && node !== parent) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

export default function installDropdownArrow(): void {
  // jQuery: o Bootstrap do core dispara os eventos do dropdown por ela.
  $(document)
    .on('shown.bs.dropdown', '.Dropdown', function (this: HTMLElement, event: JQuery.TriggeredEvent) {
      // Só o dropdown que abriu (o evento sobe pelos dropdowns de fora).
      if (event.target === this) placeArrow(this);
    })
    .on('hidden.bs.dropdown', '.Dropdown', function (this: HTMLElement, event: JQuery.TriggeredEvent) {
      if (event.target === this) removeArrow(this);
    });
}
