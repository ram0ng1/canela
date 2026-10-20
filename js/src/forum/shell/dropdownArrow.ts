/*
 * A seta dos menus que abrem de um botão só com ícone (o sino de acompanhar,
 * o ⋮ do tópico e das postagens…) e de alguns de texto (ALSO): um bico na
 * borda do menu apontando para o botão, para ficar claro de onde ele saiu.
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

/**
 * Menus de botão com texto que também levam a seta: o "Acompanhando ▾" do
 * rodapé do tópico (o mesmo menu do sino, que já tem seta) e o da data da
 * postagem ("8 h": número, data completa e link do post).
 */
const ALSO = '.CanelaNotifications, .PostMeta';

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

  if (!toggle || !menu || !(iconOnly(toggle) || dropdown.matches(ALSO))) return;

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

/**
 * O post com um menu aberto sobe acima dos seguintes (Components.less). A
 * classe substitui `.PostStream-item:has(.Dropdown.open)`: com o `:has()`, o
 * navegador reavaliava cada post a cada post carregado na rolagem.
 */
const POST_OPEN_CLASS = 'CanelaPost--menuOpen';

function markPost(dropdown: HTMLElement, open: boolean): void {
  // Um menu que sumiu aberto (o post redesenhado) não deixa a classe para trás.
  if (open) document.querySelectorAll(`.${POST_OPEN_CLASS}`).forEach((item) => item.classList.remove(POST_OPEN_CLASS));

  dropdown.closest('.PostStream-item')?.classList.toggle(POST_OPEN_CLASS, open);
}

export default function installDropdownArrow(): void {
  // jQuery: o Bootstrap do core dispara os eventos do dropdown por ela.
  $(document)
    // O core mede se o menu cabe embaixo SEM tirar antes o `--top` da vez
    // anterior (Dropdown.tsx): aberto para cima, ele "cabe", perde a classe e
    // abre para baixo (cortado); na vez seguinte não cabe e volta para cima,
    // alternando a cada clique. Sem a classe antes de abrir, a conta parte
    // sempre da posição normal, embaixo do botão.
    .on('show.bs.dropdown', '.Dropdown', function (this: HTMLElement, event: JQuery.TriggeredEvent) {
      if (event.target !== this) return;

      this.querySelector(':scope > .Dropdown-menu')?.classList.remove('Dropdown-menu--top');
      markPost(this, true);
    })
    .on('shown.bs.dropdown', '.Dropdown', function (this: HTMLElement, event: JQuery.TriggeredEvent) {
      // Só o dropdown que abriu (o evento sobe pelos dropdowns de fora).
      if (event.target === this) placeArrow(this);
    })
    .on('hidden.bs.dropdown', '.Dropdown', function (this: HTMLElement, event: JQuery.TriggeredEvent) {
      if (event.target !== this) return;

      removeArrow(this);
      markPost(this, false);
    });
}

/**
 * A mesma seta para os menus presos à tela que não são o Dropdown do core (os
 * do rodapé do composer: ⊕, emoji, ajudante de IA). `box` é o elemento fixo
 * que define a posição do menu; `surface`, o que tem o fundo e a borda (o
 * próprio menu, quando é o mesmo). A seta fica no `body`, também fixa: a
 * barra de formatação rola na horizontal e cortaria qualquer coisa dentro
 * dela. Devolve `place` (para chamar quando o menu mudar de lugar) e `remove`.
 */
export function attachFixedArrow(box: HTMLElement, toggle: HTMLElement, surface: HTMLElement = box): { place: () => void; remove: () => void } {
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');

  const place = () => {
    const style = getComputedStyle(surface);

    // A folha do celular (presa ao pé da tela, largura toda) não aponta.
    if (window.innerWidth < 768 || style.display === 'none') {
      arrow.remove();
      return;
    }

    arrow.style.setProperty('--cn-arrow-bg', style.backgroundColor);
    if (parseFloat(style.borderTopWidth) > 0) arrow.style.setProperty('--cn-arrow-edge', style.borderTopColor);

    const z = parseInt(getComputedStyle(box).zIndex, 10);
    arrow.style.zIndex = Number.isNaN(z) ? '' : String(z + 1);

    // Pela posição de layout (sem as animações de entrada do menu).
    const left = box.offsetLeft;
    const top = box.offsetTop;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    const t = toggle.getBoundingClientRect();
    const up = top + height <= t.top + 1;
    const x = Math.min(Math.max(t.left + t.width / 2, left + EDGE), left + width - EDGE);

    arrow.className = `${ARROW_CLASS} ${ARROW_CLASS}--fixed${up ? ' is-up' : ''}`;
    arrow.style.left = `${x - WIDTH / 2}px`;
    arrow.style.top = `${up ? top + height - 1 : top - HEIGHT + 1}px`;

    if (!arrow.isConnected) document.body.appendChild(arrow);
  };

  place();

  return { place, remove: () => arrow.remove() };
}

/** O vão entre o botão e um menu fixo com a seta. */
export const FIXED_ARROW_GAP = GAP;
