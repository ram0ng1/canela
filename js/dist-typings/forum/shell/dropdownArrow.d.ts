export default function installDropdownArrow(): void;
/**
 * A mesma seta para os menus presos à tela que não são o Dropdown do core (os
 * do rodapé do composer: ⊕, emoji, ajudante de IA). `box` é o elemento fixo
 * que define a posição do menu; `surface`, o que tem o fundo e a borda (o
 * próprio menu, quando é o mesmo). A seta fica no `body`, também fixa: a
 * barra de formatação rola na horizontal e cortaria qualquer coisa dentro
 * dela. Devolve `place` (para chamar quando o menu mudar de lugar) e `remove`.
 */
export declare function attachFixedArrow(box: HTMLElement, toggle: HTMLElement, surface?: HTMLElement): {
    place: () => void;
    remove: () => void;
};
/** O vão entre o botão e um menu fixo com a seta. */
export declare const FIXED_ARROW_GAP = 10;
