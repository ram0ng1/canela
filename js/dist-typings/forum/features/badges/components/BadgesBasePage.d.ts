import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
/**
 * Base de /badges e /badges/:id: o cartão do PageStructure sem a coluna
 * lateral (a navegação está na barra global), o título da aba e o histórico.
 *
 * Com os emblemas desligados o servidor já responde 404 a quem chega pelo
 * endereço; o aviso cobre quem estava com o fórum aberto quando a opção mudou.
 */
export default abstract class BadgesBasePage<Attrs extends IPageAttrs = IPageAttrs> extends Page<Attrs> {
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    updateTitle(): void;
    view(): Mithril.Children;
    abstract title(): string;
    abstract className(): string;
    abstract content(): Mithril.Children;
}
