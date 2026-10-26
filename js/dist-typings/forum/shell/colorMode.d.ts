import Component from 'flarum/common/Component';
import type Mithril from 'mithril';
/**
 * "Automático" + alto contraste: o core resolve `auto` para `light`/`dark`
 * (só soma `-hc` quando o sistema pede contraste); aqui o `-hc` entra também
 * quando a pessoa escolheu a paleta de alto contraste.
 */
export declare function installColorMode(): void;
/**
 * O nome curto do tema: o que vem antes de um separador ("Bespoke — Custom
 * Theme & Live Preview" → "Bespoke"). O nome inteiro fica no title do item.
 */
export declare function themeShortName(title: string): string;
/**
 * O seletor em texto do rodapé ("🖌 Nome do tema ⌄"). Com o
 * Wardrobe e mais de um tema, mostra o pincel e o nome do tema, e o menu lista
 * os temas; as paletas (Padrão / Alto contraste) ficam numa seção separada do
 * mesmo menu. Sem o Wardrobe, é só o seletor de paletas, como antes.
 */
export declare class FooterPaletteSelector extends Component {
    view(): Mithril.Children;
}
/** O botão de modo de cor: só o ícone, com o menu de três opções. */
export declare class FooterColorMode extends Component {
    view(): Mithril.Children;
}
